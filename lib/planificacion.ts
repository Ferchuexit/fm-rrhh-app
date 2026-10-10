// FM RRHH — lib/planificacion.ts
// Lado base de datos de la planificación de vacaciones. Un solo lugar para
// "quién está afuera entre estas fechas", que usan /vacaciones (panel de
// planificación y Gantt) y /solicitudes (para decidir un pedido).
import { prisma } from "./prisma";
import { ausentesPorDia, pico, diasEnRango, brutoMensualReferencia, costoEnRango, type Ausencia, type Rango } from "./planificacion-reglas";
export * from "./planificacion-reglas";

const DIA_MS = 24 * 3600 * 1000;

// Vacaciones registradas (firmes) y pedidos de vacaciones sin responder
// (pendientes) que tocan el rango, de la gente activa de la empresa.
export async function ausenciasDelRango(empresaId: string, r: Rango, centroCostoId?: string | null): Promise<Ausencia[]> {
  const legajo = { empresaId, condicion: "activo", ...(centroCostoId ? { centroCostoId } : {}) };
  const [vacaciones, pedidos] = await Promise.all([
    prisma.vacacion.findMany({ where: { legajo, fechaDesde: { lte: r.hasta }, fechaHasta: { gte: r.desde } }, select: { legajoId: true, fechaDesde: true, fechaHasta: true } }),
    prisma.solicitudAusencia.findMany({ where: { legajo, tipo: "vacaciones", estado: "pendiente", fechaDesde: { lte: r.hasta }, fechaHasta: { gte: r.desde } }, select: { legajoId: true, fechaDesde: true, fechaHasta: true } }),
  ]);
  return [
    ...vacaciones.map((v) => ({ legajoId: v.legajoId, desde: v.fechaDesde, hasta: v.fechaHasta })),
    ...pedidos.map((p) => ({ legajoId: p.legajoId, desde: p.fechaDesde, hasta: p.fechaHasta, pendiente: true })),
  ];
}

// Sueldo de referencia de cada legajo: sus últimas liquidaciones vigentes de
// períodos CERRADOS (números firmes), hasta cubrir más o menos un mes.
async function sueldosDeReferencia(legajoIds: string[]): Promise<Map<string, number>> {
  const liquidaciones = await prisma.liquidacion.findMany({
    where: { legajoId: { in: legajoIds }, vigente: true, periodo: { estado: "cerrada" } },
    select: { legajoId: true, bruto: true, periodo: { select: { fechaDesde: true, fechaHasta: true } } },
    orderBy: { periodo: { fechaHasta: "desc" } },
  });
  const porLegajo = new Map<string, { bruto: number; dias: number }[]>();
  for (const l of liquidaciones) {
    const lista = porLegajo.get(l.legajoId) ?? [];
    if (lista.reduce((a, x) => a + x.dias, 0) >= 28) continue; // ya tiene un mes de referencia
    lista.push({ bruto: Number(l.bruto), dias: Math.round((l.periodo.fechaHasta.getTime() - l.periodo.fechaDesde.getTime()) / DIA_MS) + 1 });
    porLegajo.set(l.legajoId, lista);
  }
  const sueldos = new Map<string, number>();
  for (const [id, lista] of porLegajo) {
    const mensual = brutoMensualReferencia(lista);
    if (mensual !== null) sueldos.set(id, mensual);
  }
  return sueldos;
}

export async function planificar(empresaId: string, r: Rango, centroCostoId: string | null, conCostos: boolean) {
  const legajos = await prisma.legajo.findMany({
    where: { empresaId, condicion: "activo", ...(centroCostoId ? { centroCostoId } : {}) },
    select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } },
    orderBy: { numeroLegajo: "asc" },
  });
  const ausencias = await ausenciasDelRango(empresaId, r, centroCostoId);
  const dias = ausentesPorDia(r, ausencias);
  const diasDelRango = dias.length;

  const sueldos = conCostos ? await sueldosDeReferencia(legajos.map((l) => l.id)) : new Map<string, number>();
  const personas = legajos.map((l) => {
    const propias = ausencias.filter((a) => a.legajoId === l.id);
    const diasFirmes = propias.filter((a) => !a.pendiente).reduce((s, a) => s + diasEnRango(a, r), 0);
    const diasPendientes = propias.filter((a) => a.pendiente).reduce((s, a) => s + diasEnRango(a, r), 0);
    const mensual = sueldos.get(l.id) ?? null;
    return {
      id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, sector: l.centroCosto?.nombre ?? "Sin asignar",
      diasFirmes, diasPendientes,
      costo: conCostos && mensual !== null
        ? { mensual, firmes: costoEnRango(mensual, diasDelRango, diasFirmes), conPendientes: costoEnRango(mensual, diasDelRango, diasFirmes + diasPendientes) }
        : null,
    };
  });

  const suma = (campo: "firmes" | "conPendientes") => {
    const t = { masa: 0, vacaciones: 0, adicional: 0 };
    for (const p of personas) if (p.costo) { t.masa += p.costo[campo].masa; t.vacaciones += p.costo[campo].vacaciones; t.adicional += p.costo[campo].adicional; }
    return { ...t, total: t.masa + t.adicional };
  };

  // Lo que REALMENTE se liquidó en períodos cerrados que tocan el rango —
  // para fechas pasadas, es el dato firme contra el que comparar.
  const liquidado = conCostos
    ? (await prisma.periodo.findMany({
        where: { empresaId, estado: "cerrada", fechaDesde: { lte: r.hasta }, fechaHasta: { gte: r.desde } },
        select: { nombre: true, fechaDesde: true, fechaHasta: true, liquidaciones: { where: { vigente: true, legajoId: { in: legajos.map((l) => l.id) } }, select: { bruto: true } } },
        orderBy: { fechaDesde: "asc" },
      })).map((p) => ({ nombre: p.nombre, fechaDesde: p.fechaDesde, fechaHasta: p.fechaHasta, legajos: p.liquidaciones.length, bruto: p.liquidaciones.reduce((a, l) => a + Number(l.bruto), 0) }))
    : null;

  return {
    dotacion: legajos.length,
    diasDelRango,
    dias: dias.map((d) => ({ fecha: d.fecha, firmes: d.firmes, conPendientes: d.conPendientes })),
    pico: { firmes: pico(dias, "firmes"), conPendientes: pico(dias, "conPendientes") },
    diasVacaciones: { firmes: personas.reduce((a, p) => a + p.diasFirmes, 0), pendientes: personas.reduce((a, p) => a + p.diasPendientes, 0) },
    personas: personas.filter((p) => p.diasFirmes + p.diasPendientes > 0),
    costos: conCostos ? { firmes: suma("firmes"), conPendientes: suma("conPendientes"), sinSueldo: personas.filter((p) => !p.costo).length } : null,
    liquidado,
  };
}
