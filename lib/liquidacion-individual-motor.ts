// FM RRHH — lib/liquidacion-individual-motor.ts
//
// Arma el mismo contexto que arma app/api/liquidar/route.ts para UN legajo
// (escala vigente, reglas del convenio, novedades del período → insumos
// directos, valores por categoría, topes) para poder recalcular en vivo
// desde Liquidación Individual usando el motor real.
//
// DECISIÓN DE DISEÑO (07/09/2026): esto es una COPIA deliberada de esa
// sección de route.ts, no una extracción/refactor compartido. route.ts
// está validado al centavo contra datos reales de Moras SA y no tengo forma
// de correr esa ruta contra tu base real desde acá — tocarla sin poder
// probarla es más riesgo del que vale la pena. Si con el tiempo esto
// funciona bien probado en vivo, unificar los dos en un solo lugar (como ya
// hiciste con armar-recibo.ts) es la mejora natural — pero con tu OK y con
// la posibilidad de probarlo contra Moras antes de confiar en el resultado.
//
// LO QUE HACE ESTE ARCHIVO: solo arma el contexto del motor de reglas
// (escala, novedades, topes, valores por categoría) para un legajo. El
// recálculo de SAC/Ganancias/Embargos vive en
// lib/liquidacion-individual-recalculo.ts, que se agregó en una etapa
// posterior (07/09/2026) reutilizando las mismas funciones puras que usa
// la Masiva — no repite este archivo, lo complementa.
import { prisma } from "@/lib/prisma";
import { armarContextoTopes } from "@/lib/motor/parametros-topes.mjs";
import { calcularDiasTrabajadosEnPeriodo } from "@/lib/motor/prorrateo.mjs";
import { calcularAntiguedadAnios } from "@/lib/vacaciones";

// Códigos que este módulo sabe recalcular dinámicamente. Si el usuario los
// forzó o excluyó a mano, el llamador NO debe pedir el recálculo dinámico
// para ellos — ver lib/liquidacion-individual-recalculo.ts, que es quien
// hace ese recálculo ahora (antes se preservaban tal cual, sin tocar).

export async function construirContextoMotorLegajo(legajoId: string, periodoId: string) {
  const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: legajoId } });
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
  if (!escala) return { ok: false as const, error: "No hay escala vigente para esta categoría en este período." };

  const reglasDb = await prisma.reglaConcepto.findMany({
    where: {
      convenioId: legajo.convenioId,
      vigenciaDesde: { lte: fechaReferencia },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
    },
    include: { concepto: true },
  });
  const reglas = reglasDb.map((r) => ({ conceptoCodigo: r.concepto.codigo, formula: r.formula, aporta: r.aporta, contribuye: r.contribuye }));
  if (reglas.length === 0) return { ok: false as const, error: "Este convenio no tiene ninguna fórmula cargada todavía." };

  const antiguedadAnios = calcularAntiguedadAnios(legajo.fechaIngreso, legajo.antiguedadReconocida, fechaReferencia);

  const novedadesDelLegajo = await prisma.novedad.findMany({
    where: { legajoId: legajo.id, periodo: { gte: fechaReferencia, lte: fechaFinPeriodo }, estado: "valida" },
    include: { concepto: true },
  });

  const horasCargadas = novedadesDelLegajo.filter((n) => n.concepto.codigo === "HS_NORMALES").reduce((a, n) => a + (n.cantidad ?? 0), 0);
  const hayHorasCargadas = novedadesDelLegajo.some((n) => n.concepto.codigo === "HS_NORMALES");

  const diasTrabajadosReales = calcularDiasTrabajadosEnPeriodo({
    fechaDesdePeriodo: fechaReferencia,
    fechaHastaPeriodo: fechaFinPeriodo,
    fechaIngresoLegajo: legajo.fechaIngreso,
    fechaEgresoLegajo: legajo.fechaEgreso,
  });
  const proporcionDelMes = diasDelPeriodo > 0 ? diasTrabajadosReales / diasDelPeriodo : 1;
  const basicoProrrateado = proporcionDelMes < 1 ? escala.basico * proporcionDelMes : escala.basico;

  const varsBase = {
    BASICO: basicoProrrateado,
    VALOR_HORA: escala.valorHora,
    ANTIGUEDAD_ANIOS: Math.floor(antiguedadAnios),
    DIAS_TRABAJADOS: diasTrabajadosReales,
    DIAS_MES: diasDelPeriodo,
    HORAS_TRABAJADAS: hayHorasCargadas ? horasCargadas : diasTrabajadosReales * 8,
    AFILIADO_SINDICATO: legajo.afiliadoSindicato ? 1 : 0,
  };

  const codigosConRegla = new Set(reglas.map((r) => r.conceptoCodigo));
  const insumosDirectosNovedades: Record<string, number> = {};
  const cantidadesPorConcepto: Record<string, number> = {};
  for (const n of novedadesDelLegajo) {
    if (n.concepto.codigo === "HS_NORMALES") continue;
    cantidadesPorConcepto[n.concepto.codigo] = (cantidadesPorConcepto[n.concepto.codigo] ?? 0) + (n.cantidad ?? 0);
    if (!codigosConRegla.has(n.concepto.codigo)) {
      let importe: number;
      if (n.concepto.unidad === "horas") {
        const multiplicador = n.concepto.codigo.includes("100") ? 2 : n.concepto.codigo.includes("50") ? 1.5 : 1;
        importe = (n.cantidad ?? 0) * varsBase.VALOR_HORA * multiplicador;
      } else {
        importe = n.valor ?? n.cantidad ?? 0;
      }
      insumosDirectosNovedades[n.concepto.codigo] = (insumosDirectosNovedades[n.concepto.codigo] ?? 0) + importe;
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

  const todosLosParametros = await prisma.parametroVigente.findMany();
  const clavesParametros = [...new Set(todosLosParametros.map((p) => p.clave))];
  const { contexto: topes } = armarContextoTopes(clavesParametros, fechaReferencia, todosLosParametros as any);

  const conceptos = await prisma.concepto.findMany();

  return {
    ok: true as const,
    legajo,
    periodo,
    varsBase,
    reglas,
    conceptos,
    insumosDirectosNovedades,
    cantidadesPorConcepto,
    valoresCategoria,
    topes,
  };
}
