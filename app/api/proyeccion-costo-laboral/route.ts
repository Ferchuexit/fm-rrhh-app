// FM RRHH — app/api/proyeccion-costo-laboral/route.ts
//
// GET ?hastaMes=YYYY-MM&convenioId=X&modo=historico|manual&porcentajeManual=5.2
//
// Proyecta el costo laboral (bruto + contribuciones YA MODELADAS: SIPA,
// obra social, ART, seguro de vida) desde el último mes con liquidaciones
// reales hasta el mes elegido, aplicando una tasa mensual compuesta.
//
// "modo=historico": la tasa se calcula sola, a partir de los aumentos
// reales de Escala.basico a lo largo del tiempo (ver calcularTasaHistorica
// más abajo — queda documentado el método, no es una caja negra).
// "modo=manual": la tasa la da el usuario directamente.
//
// LO QUE NO INCLUYE, A PROPÓSITO: costo de sindicatos (boletas mensuales
// tipo INACAP + seguros asociados, distintas por convenio) — Fernando
// confirmó que existen pero no las tenemos cargadas ni con importes/tasas
// confirmados. Se devuelve como línea aparte marcada "pendiente", nunca
// mezclada en el total, para no subestimar el costo real sin avisar.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

// Tasa mensual promedio a partir del historial real de aumentos de básico
// por categoría. Para cada categoría con 2+ vigencias de Escala, calcula
// el % de aumento entre vigencias consecutivas y lo "mensualiza"
// (compuesto) según cuántos meses pasaron entre una y otra — así un
// aumento del 10% cada 3 meses no se confunde con un 10% mensual. Después
// promedia esa tasa mensual entre todas las categorías con historial.
function calcularTasaHistorica(escalas: { categoriaId: string; vigenciaDesde: Date; basico: number }[]): { tasaMensual: number | null; aumentosUsados: number } {
  const porCategoria = new Map<string, { vigenciaDesde: Date; basico: number }[]>();
  for (const e of escalas) {
    if (!porCategoria.has(e.categoriaId)) porCategoria.set(e.categoriaId, []);
    porCategoria.get(e.categoriaId)!.push({ vigenciaDesde: e.vigenciaDesde, basico: e.basico });
  }

  const tasasMensuales: number[] = [];
  for (const lista of porCategoria.values()) {
    lista.sort((a, b) => a.vigenciaDesde.getTime() - b.vigenciaDesde.getTime());
    for (let i = 1; i < lista.length; i++) {
      const anterior = lista[i - 1];
      const actual = lista[i];
      if (anterior.basico <= 0) continue;
      const pctAumento = (actual.basico - anterior.basico) / anterior.basico;
      const meses = (actual.vigenciaDesde.getTime() - anterior.vigenciaDesde.getTime()) / (30.44 * 24 * 3600 * 1000);
      if (meses < 0.5) continue; // dos vigencias casi el mismo día — no es un dato de aumento real, se descarta
      const tasaMensual = Math.pow(1 + pctAumento, 1 / meses) - 1;
      tasasMensuales.push(tasaMensual);
    }
  }

  if (tasasMensuales.length === 0) return { tasaMensual: null, aumentosUsados: 0 };
  const promedio = tasasMensuales.reduce((a, t) => a + t, 0) / tasasMensuales.length;
  return { tasaMensual: promedio, aumentosUsados: tasasMensuales.length };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hastaMesStr = searchParams.get("hastaMes"); // "YYYY-MM"
    const convenioId = searchParams.get("convenioId");
    const modo = searchParams.get("modo") ?? "historico";
    const porcentajeManualStr = searchParams.get("porcentajeManual");

    if (!hastaMesStr) return NextResponse.json({ error: "Falta hastaMes." }, { status: 400 });

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

    // ── Base: el último mes con liquidaciones reales ──
    const ultimoPeriodo = await prisma.periodo.findFirst({
      where: { empresaId: empresa.id, liquidaciones: { some: {} } },
      orderBy: { fechaDesde: "desc" },
    });
    if (!ultimoPeriodo) {
      return NextResponse.json({ error: "No hay ningún período liquidado todavía — no hay desde dónde proyectar." }, { status: 400 });
    }

    const liquidacionesBase = await prisma.liquidacion.findMany({
      where: { periodoId: ultimoPeriodo.id, legajo: convenioId ? { convenioId } : {} },
      include: { detalle: { include: { concepto: true }, where: { concepto: { tipo: "contribucion_patronal" } } } },
    });
    const brutoBase = liquidacionesBase.reduce((a, l) => a + l.bruto, 0);
    const contribucionesBase = liquidacionesBase.reduce((a, l) => a + l.detalle.reduce((x, d) => x + d.importe, 0), 0);
    const costoBase = brutoBase + contribucionesBase;

    // ── Tasa mensual a aplicar ──
    let tasaMensual: number;
    let metodologia: string;
    let aumentosUsados = 0;

    if (modo === "manual") {
      const pct = Number(porcentajeManualStr);
      if (porcentajeManualStr === null || isNaN(pct)) {
        return NextResponse.json({ error: "Elegiste modo manual pero no mandaste un porcentaje válido." }, { status: 400 });
      }
      tasaMensual = pct / 100;
      metodologia = `Porcentaje mensual cargado a mano: ${pct}%.`;
    } else {
      const escalas = await prisma.escala.findMany({
        where: { convenioId: convenioId ?? undefined },
        select: { categoriaId: true, vigenciaDesde: true, basico: true },
      });
      const resultado = calcularTasaHistorica(escalas);
      aumentosUsados = resultado.aumentosUsados;
      if (resultado.tasaMensual === null) {
        return NextResponse.json({
          error: "No hay suficiente historial de aumentos en Escala para calcular una tasa histórica (hace falta al menos 2 vigencias para alguna categoría). Usá modo manual con un porcentaje a tu criterio.",
        }, { status: 400 });
      }
      tasaMensual = resultado.tasaMensual;
      metodologia = `Tasa mensual promedio calculada de ${aumentosUsados} aumento(s) reales de Escala.basico, mensualizados (compuestos) según el tiempo real entre vigencias.`;
    }

    // ── Proyección mes a mes ──
    const [hastaAnio, hastaMes] = hastaMesStr.split("-").map(Number);
    const mesBase = new Date(Date.UTC(ultimoPeriodo.fechaDesde.getUTCFullYear(), ultimoPeriodo.fechaDesde.getUTCMonth(), 1));
    const mesHasta = new Date(Date.UTC(hastaAnio, hastaMes - 1, 1));

    if (mesHasta <= mesBase) {
      return NextResponse.json({ error: `El mes hasta tiene que ser posterior al último mes liquidado (${mesBase.toISOString().substring(0, 7)}).` }, { status: 400 });
    }

    const serie: { mes: string; costoProyectado: number }[] = [];
    let n = 1;
    for (const d = new Date(mesBase); d < mesHasta; ) {
      d.setUTCMonth(d.getUTCMonth() + 1);
      const costoProyectado = costoBase * Math.pow(1 + tasaMensual, n);
      serie.push({ mes: d.toISOString().substring(0, 7), costoProyectado });
      n++;
    }

    return NextResponse.json({
      mesBase: mesBase.toISOString().substring(0, 7),
      costoBase,
      brutoBase,
      contribucionesBase,
      tasaMensual: tasaMensual * 100, // en %, para mostrar directo
      metodologia,
      serie,
      totalProyectadoAcumulado: serie.reduce((a, s) => a + s.costoProyectado, 0),
      sindicatos: {
        incluido: false,
        nota: "No incluido — faltan confirmar las boletas mensuales por convenio (ej. INACAP + seguros asociados para Comercio) y sus importes o tasas reales.",
      },
    });
  } catch (e: any) {
    console.error("Error en GET /api/proyeccion-costo-laboral:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo calcular la proyección." }, { status: 500 });
  }
}
