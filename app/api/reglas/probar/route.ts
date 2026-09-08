// FM RRHH — app/api/reglas/probar/route.ts
// "Probar concepto": corre el motor de reglas de verdad, contra un legajo y
// período reales, con la fórmula que se está escribiendo (todavía sin
// guardar) — para ver el resultado antes de confirmar. NO persiste nada en
// la base — ni una Liquidacion, ni un LiquidacionDetalle.
//
// Reutiliza la misma lógica de armado de contexto que /api/liquidar
// (varsBase, insumosDirectos, cantidades, valoresCategoria) — si el día de
// mañana esa lógica cambia, hay que actualizar los dos lugares. No se
// extrajo a un helper compartido en esta vuelta para no arriesgar romper
// /api/liquidar, que ya está validado contra un recibo real.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liquidarLegajo, formulaConValores } from "@/lib/motor/motor-reglas.mjs";

export async function POST(req: Request) {
  try {
    const { legajoId, periodoId, conceptoCodigo, formula } = await req.json();
    if (!legajoId || !periodoId || !conceptoCodigo || !formula) {
      return NextResponse.json({ error: "Faltan legajoId, periodoId, conceptoCodigo o formula." }, { status: 400 });
    }

    const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: legajoId }, include: { categoria: true, convenio: true } });
    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
    const fechaReferencia = periodo.fechaDesde;
    const fechaFinPeriodo = periodo.fechaHasta;
    const diasDelPeriodo = Math.round((fechaFinPeriodo.getTime() - fechaReferencia.getTime()) / (24 * 3600 * 1000)) + 1;

    const escala = await prisma.escala.findFirst({
      where: {
        categoriaId: legajo.categoriaId,
        vigenciaDesde: { lte: fechaReferencia },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
      },
      orderBy: { vigenciaDesde: "desc" },
    });
    if (!escala) {
      return NextResponse.json({ error: `No hay escala vigente para la categoría de este legajo en este período.` }, { status: 400 });
    }

    const conceptos = await prisma.concepto.findMany();
    const conceptoAProbar = conceptos.find((c) => c.codigo === conceptoCodigo);
    if (!conceptoAProbar) {
      return NextResponse.json({ error: `No existe ningún concepto con código "${conceptoCodigo}".` }, { status: 400 });
    }

    const reglasDb = await prisma.reglaConcepto.findMany({
      where: {
        convenioId: legajo.convenioId,
        vigenciaDesde: { lte: fechaReferencia },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
      },
      include: { concepto: true },
    });
    let reglas = reglasDb.map((r) => ({
      conceptoCodigo: r.concepto.codigo,
      formula: r.formula,
      aporta: r.aporta,
      contribuye: r.contribuye,
    }));

    // Reemplaza (o agrega, si es un concepto nuevo que todavía no tiene
    // regla guardada) la fórmula que se está probando — esto es lo que
    // hace que "Probar" refleje lo que se está escribiendo AHORA, no lo
    // último que se guardó.
    const yaExiste = reglas.find((r) => r.conceptoCodigo === conceptoCodigo);
    if (yaExiste) {
      yaExiste.formula = formula;
    } else {
      reglas.push({ conceptoCodigo, formula, aporta: conceptoAProbar.tipo === "remunerativo", contribuye: conceptoAProbar.tipo === "remunerativo" });
    }

    const antiguedadAnios = (fechaReferencia.getTime() - legajo.fechaIngreso.getTime()) / (365.25 * 24 * 3600 * 1000);
    const varsBase = {
      BASICO: escala.basico,
      VALOR_HORA: escala.valorHora,
      ANTIGUEDAD_ANIOS: Math.floor(antiguedadAnios),
      DIAS_TRABAJADOS: diasDelPeriodo,
      DIAS_MES: diasDelPeriodo,
      HORAS_TRABAJADAS: diasDelPeriodo * 8,
    };

    const codigosConRegla = new Set(reglas.map((r) => r.conceptoCodigo));
    const novedadesDelLegajo = await prisma.novedad.findMany({
      where: { legajoId: legajo.id, periodo: { gte: fechaReferencia, lte: fechaFinPeriodo }, estado: "valida" },
      include: { concepto: true },
    });
    const insumosDirectos: Record<string, number> = {};
    const cantidadesPorConcepto: Record<string, number> = {};
    for (const n of novedadesDelLegajo) {
      cantidadesPorConcepto[n.concepto.codigo] = (cantidadesPorConcepto[n.concepto.codigo] ?? 0) + (n.cantidad ?? 0);
      if (!codigosConRegla.has(n.concepto.codigo)) {
        let importe: number;
        if (n.concepto.unidad === "horas") {
          const multiplicador = n.concepto.codigo.includes("100") ? 2 : n.concepto.codigo.includes("50") ? 1.5 : 1;
          importe = (n.cantidad ?? 0) * varsBase.VALOR_HORA * multiplicador;
        } else {
          importe = n.valor ?? n.cantidad ?? 0;
        }
        insumosDirectos[n.concepto.codigo] = (insumosDirectos[n.concepto.codigo] ?? 0) + importe;
      }
    }

    const valoresCategoriaDb = await prisma.valorConceptoCategoria.findMany({
      where: {
        categoriaId: legajo.categoriaId,
        vigenciaDesde: { lte: fechaReferencia },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
      },
      include: { concepto: true },
      orderBy: { vigenciaDesde: "desc" },
    });
    const valoresCategoria: Record<string, number> = {};
    for (const v of valoresCategoriaDb) {
      if (!(v.concepto.codigo in valoresCategoria)) valoresCategoria[v.concepto.codigo] = v.valor;
    }

    let resultado;
    try {
      resultado = liquidarLegajo({ varsBase, conceptos: conceptos as any, reglas, insumosDirectos, cantidades: cantidadesPorConcepto, valoresCategoria });
    } catch (e: any) {
      return NextResponse.json({ error: `Error al evaluar: ${e.message}` }, { status: 400 });
    }

    const lineaDelConcepto = resultado.detalle.find((d: any) => d.conceptoCodigo === conceptoCodigo);

    // Traza — reconstruye el contexto tal cual quedó después de liquidar,
    // para mostrar la fórmula con los valores reales ya adentro.
    let traza = null;
    try {
      const contextParaTraza = {
        vars: varsBase,
        conceptos: Object.fromEntries(resultado.detalle.map((d: any) => [d.conceptoCodigo, d.importe])),
        topes: {},
        remTotal: resultado.remTotal,
        noRemTotal: resultado.remNoRemun,
        cantidades: cantidadesPorConcepto,
        valoresCategoria,
        conceptoActual: conceptoCodigo,
      };
      traza = formulaConValores(formula, contextParaTraza);
    } catch {
      // Si la traza falla por algún motivo (no debería, si el resultado ya
      // se calculó bien arriba), no es grave — se muestra el resultado
      // igual, solo sin el desglose paso a paso.
    }

    return NextResponse.json({
      legajo: { numero: legajo.numeroLegajo, apellido: legajo.apellido, nombre: legajo.nombre, categoria: legajo.categoria.nombre, convenio: legajo.convenio.codigo },
      conceptoCodigo,
      importe: lineaDelConcepto?.importe ?? null,
      traza,
      detalleCompleto: resultado.detalle.map((d: any) => ({ concepto: d.conceptoCodigo, nombre: d.nombre, importe: d.importe })),
      bruto: resultado.bruto,
      neto: resultado.neto,
    });
  } catch (e: any) {
    console.error("Error en POST /api/reglas/probar:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al probar la fórmula." }, { status: 500 });
  }
}
