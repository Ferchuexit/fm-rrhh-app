// FM RRHH — lib/centro-control.ts
//
// "Centro de Control RR.HH." (documento de mejora, sección 17) — reusa
// casi todo de lo que ya existe (dashboard-data.ts, auditoria-comparativa.ts,
// motor-auditoria.mjs) y agrega solo dos cosas nuevas: costo por empleado
// con su variación, y ausentismo como PORCENTAJE (hasta ahora solo lo
// mostrábamos en horas absolutas).
//
// El % de ausentismo acá es una aproximación honesta, no una tasa exacta:
// horas de ausencia cargadas / horas teóricas totales de la nómina (dotación
// × días del período × 8hs). No usa el módulo de asistencia/fichadas (no
// todos los clientes lo cargan) — es más simple, pero menos preciso que una
// tasa real basada en fichadas. Documentado así a propósito, no escondido.
import { prisma } from "./prisma";
import { obtenerAuditoriaComparativa } from "./auditoria-comparativa";
import { obtenerResultadoAuditoria } from "./auditoria-context";

const CODIGOS_AUSENCIA = ["HS_AUSENCIAS", "ENFERMEDADES", "FERIADOS", "HS_ACCIDENTE", "VACACIONES_HORAS"];

export async function obtenerCentroControl(periodoId: string) {
  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  const diasDelPeriodo = Math.round((periodo.fechaHasta.getTime() - periodo.fechaDesde.getTime()) / (24 * 3600 * 1000)) + 1;

  const comparativa = await obtenerAuditoriaComparativa(periodoId);

  const costoPorEmpleadoActual = comparativa.dotacion.actual > 0 ? comparativa.costoLaboral.actual / comparativa.dotacion.actual : 0;
  const costoPorEmpleadoAnterior =
    comparativa.dotacion.anterior && comparativa.dotacion.anterior > 0 && comparativa.costoLaboral.anterior !== null
      ? comparativa.costoLaboral.anterior / comparativa.dotacion.anterior
      : null;
  const costoPorEmpleadoVariacionPct =
    costoPorEmpleadoAnterior === null || costoPorEmpleadoAnterior === 0
      ? null
      : ((costoPorEmpleadoActual - costoPorEmpleadoAnterior) / costoPorEmpleadoAnterior) * 100;

  async function ausentismoPct(fechaDesde: Date, fechaHasta: Date, empresaId: string) {
    const dotacionDelPeriodo = await prisma.legajo.count({ where: { empresaId, condicion: "activo" } });
    const horasTeoricas = dotacionDelPeriodo * diasDelPeriodo * 8;
    if (horasTeoricas === 0) return null;

    const novedades = await prisma.novedad.findMany({
      where: { legajo: { empresaId }, periodo: { gte: fechaDesde, lte: fechaHasta }, concepto: { codigo: { in: CODIGOS_AUSENCIA } } },
    });
    const horasAusencia = novedades.reduce((a, n) => a + (n.cantidad ?? 0), 0);
    return (horasAusencia / horasTeoricas) * 100;
  }

  const ausentismoActual = await ausentismoPct(periodo.fechaDesde, periodo.fechaHasta, periodo.empresaId);

  let ausentismoAnterior: number | null = null;
  if (comparativa.periodoAnterior) {
    const periodoAnteriorCompleto = await prisma.periodo.findUniqueOrThrow({ where: { id: comparativa.periodoAnterior.id } });
    ausentismoAnterior = await ausentismoPct(periodoAnteriorCompleto.fechaDesde, periodoAnteriorCompleto.fechaHasta, periodo.empresaId);
  }
  const ausentismoVariacionPuntos = ausentismoActual !== null && ausentismoAnterior !== null ? ausentismoActual - ausentismoAnterior : null;

  let alertasRojas = 0;
  let alertasAmarillas = 0;
  try {
    const resultadoAuditoria = await obtenerResultadoAuditoria(periodoId);
    alertasRojas = resultadoAuditoria.resumen.filter((r: any) => r.severidad === "rojo").length;
    alertasAmarillas = resultadoAuditoria.resumen.filter((r: any) => r.severidad === "amarillo").length;
  } catch {
    // Si el período todavía no tiene liquidaciones, la auditoría post no
    // tiene sentido — se muestra 0/0 en vez de romper todo el panel.
  }

  return {
    periodoActual: comparativa.periodoActual,
    periodoAnterior: comparativa.periodoAnterior,
    costoLaboral: comparativa.costoLaboral,
    dotacion: comparativa.dotacion,
    ausentismoPct: { actual: ausentismoActual, variacionPuntos: ausentismoVariacionPuntos },
    horasExtra: comparativa.horasExtraImporte,
    costoPorEmpleado: { actual: costoPorEmpleadoActual, variacionPct: costoPorEmpleadoVariacionPct },
    alertas: { rojas: alertasRojas, amarillas: alertasAmarillas },
  };
}
