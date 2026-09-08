// FM RRHH — lib/dashboard-data.ts
// Todo lo que se puede calcular de verdad con este schema reducido. Lo que
// NO se puede (costo laboral total con contribuciones patronales, aportes
// desglosados) se marca explícito con una nota, no se inventa un número.
import { prisma } from "./prisma";

const TIPOS_AUSENCIA = ["ENFERMEDAD", "ART", "AUSENCIA_INJUSTIFICADA", "VACACIONES", "FERIADO_TRABAJADO"];

export async function obtenerDatosDashboard(periodoId: string) {
  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  const fechaReferencia = periodo.fechaDesde;
  const fechaFinPeriodo = periodo.fechaHasta;

  const todosLosLegajos = await prisma.legajo.findMany({
    where: { empresaId: periodo.empresaId },
    include: { convenio: true, categoria: true },
  });
  const activos = todosLosLegajos.filter((l) => l.condicion === "activo");

  // ── Personal ──
  const altas = todosLosLegajos.filter((l) => l.fechaIngreso >= fechaReferencia && l.fechaIngreso <= fechaFinPeriodo).length;
  const bajas = todosLosLegajos.filter((l) => l.fechaEgreso && l.fechaEgreso >= fechaReferencia && l.fechaEgreso <= fechaFinPeriodo).length;

  const antiguedades = activos.map((l) => (fechaReferencia.getTime() - l.fechaIngreso.getTime()) / (365.25 * 24 * 3600 * 1000));
  const antiguedadPromedioAnios = antiguedades.length ? antiguedades.reduce((a, b) => a + b, 0) / antiguedades.length : 0;

  const porConvenioMap = new Map<string, number>();
  for (const l of activos) porConvenioMap.set(l.convenio.codigo, (porConvenioMap.get(l.convenio.codigo) ?? 0) + 1);
  const porConvenio = [...porConvenioMap.entries()].map(([convenio, cantidad]) => ({ convenio, cantidad }));

  const porCategoriaMap = new Map<string, number>();
  for (const l of activos) porCategoriaMap.set(l.categoria.nombre, (porCategoriaMap.get(l.categoria.nombre) ?? 0) + 1);
  const porCategoria = [...porCategoriaMap.entries()].map(([categoria, cantidad]) => ({ categoria, cantidad }));

  // ── Costos y Liquidación ──
  const liquidaciones = await prisma.liquidacion.findMany({ where: { periodoId } });
  const bruto = liquidaciones.reduce((a, l) => a + l.bruto, 0);
  const neto = liquidaciones.reduce((a, l) => a + l.neto, 0);
  const costoPorEmpleado = activos.length ? bruto / activos.length : 0;

  const detalles = await prisma.liquidacionDetalle.findMany({
    where: { liquidacion: { periodoId } },
    include: { concepto: true },
  });
  const horasExtraTotal = detalles.filter((d) => d.concepto.codigo.startsWith("HS_EXTRA")).reduce((a, d) => a + d.importe, 0);

  // ── Ausentismo — solo lo que realmente esté cargado como novedad de ausencia ──
  const novedadesAusencia = await prisma.novedad.findMany({
    where: {
      legajo: { empresaId: periodo.empresaId },
      periodo: { gte: fechaReferencia, lte: fechaFinPeriodo },
      concepto: { codigo: { in: TIPOS_AUSENCIA } },
    },
    include: { concepto: true },
  });
  const ausentismoPorTipo = new Map<string, number>();
  for (const n of novedadesAusencia) {
    const horas = n.cantidad ?? 0;
    ausentismoPorTipo.set(n.concepto.nombre, (ausentismoPorTipo.get(n.concepto.nombre) ?? 0) + horas);
  }

  return {
    personal: { dotacion: activos.length, altas, bajas, antiguedadPromedioAnios, porConvenio, porCategoria },
    costos: {
      masaSalarial: bruto,
      costoPorEmpleado,
      horasExtraTotal,
      nota: "Costo laboral total (con contribuciones patronales) no disponible: este schema reducido no modela contribuciones — ver 13-esqueleto-nextjs.md.",
    },
    liquidacion: {
      bruto,
      neto,
      nota: "Aportes y contribuciones desglosados no disponibles en este schema reducido (Liquidacion solo guarda bruto/neto).",
    },
    ausentismo: {
      items: [...ausentismoPorTipo.entries()].map(([tipo, horas]) => ({ tipo, horas })),
      nota: ausentismoPorTipo.size === 0 ? "No hay novedades de ausencia cargadas en este período todavía." : null,
    },
  };
}
