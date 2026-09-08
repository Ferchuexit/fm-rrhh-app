// FM RRHH — lib/auditoria-comparativa.ts
//
// A propósito usa SOLO datos que cualquier cliente tiene siempre
// (Liquidacion, LiquidacionDetalle, Novedad) — no depende del módulo de
// asistencia/fichadas, que no todos los clientes cargan. Por eso
// "ausentismo" acá se expresa en HORAS de ausencia (Novedad), no como una
// "tasa de ausentismo" (que necesitaría días laborables reales del módulo
// de asistencia) — es un dato más simple, pero universalmente disponible.
import { prisma } from "./prisma";
import { whereDeFiltro } from "./liquidar-filtro";

const CODIGOS_HS_EXTRA = ["HS_EXTRA_50", "HS_EXTRA_100"];
const CODIGOS_AUSENCIA = ["HS_AUSENCIAS", "ENFERMEDADES"];

interface Metrica {
  actual: number;
  anterior: number | null; // null = no hay período anterior con qué comparar
  variacionPct: number | null;
}

function calcularVariacion(actual: number, anterior: number | null): Metrica {
  if (anterior === null) return { actual, anterior: null, variacionPct: null };
  if (anterior === 0) return { actual, anterior, variacionPct: actual === 0 ? 0 : null };
  return { actual, anterior, variacionPct: ((actual - anterior) / anterior) * 100 };
}

export async function obtenerAuditoriaComparativa(periodoId: string) {
  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });

  const periodoAnterior = await prisma.periodo.findFirst({
    where: { empresaId: periodo.empresaId, fechaHasta: { lt: periodo.fechaDesde } },
    orderBy: { fechaHasta: "desc" },
  });

  async function metricasDelPeriodo(p: typeof periodo | null) {
    if (!p) return null;

    const whereLegajos = whereDeFiltro(p.empresaId, { modo: "todos" }, p.convenioId);
    const dotacion = await prisma.legajo.count({ where: { ...whereLegajos, condicion: "activo" } });

    const liquidaciones = await prisma.liquidacion.findMany({
      where: { periodoId: p.id, vigente: true },
      include: { detalle: { include: { concepto: true } } },
    });

    const costoLaboral = liquidaciones.reduce((a, liq) => a + liq.bruto, 0);

    let horasExtra = 0;
    let horasAusencia = 0;
    for (const liq of liquidaciones) {
      for (const d of liq.detalle) {
        if (CODIGOS_HS_EXTRA.includes(d.concepto.codigo)) horasExtra += d.importe;
      }
    }
    const novedadesAusencia = await prisma.novedad.findMany({
      where: { legajo: { empresaId: p.empresaId }, periodo: { gte: p.fechaDesde, lte: p.fechaHasta }, concepto: { codigo: { in: CODIGOS_AUSENCIA } } },
    });
    horasAusencia = novedadesAusencia.reduce((a, n) => a + (n.cantidad ?? 0), 0);

    return { dotacion, costoLaboral, horasExtraImporte: horasExtra, horasAusencia };
  }

  const [actual, anterior] = await Promise.all([metricasDelPeriodo(periodo), metricasDelPeriodo(periodoAnterior)]);

  if (!actual) throw new Error("No se pudieron calcular las métricas del período actual.");

  return {
    periodoActual: { id: periodo.id, nombre: periodo.nombre },
    periodoAnterior: periodoAnterior ? { id: periodoAnterior.id, nombre: periodoAnterior.nombre } : null,
    dotacion: calcularVariacion(actual.dotacion, anterior?.dotacion ?? null),
    costoLaboral: calcularVariacion(actual.costoLaboral, anterior?.costoLaboral ?? null),
    horasExtraImporte: calcularVariacion(actual.horasExtraImporte, anterior?.horasExtraImporte ?? null),
    horasAusencia: calcularVariacion(actual.horasAusencia, anterior?.horasAusencia ?? null),
  };
}
