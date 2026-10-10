// FM RRHH — lib/planificacion.ts
// Lado base de datos de la planificación de vacaciones. Un solo lugar para
// "quién está afuera entre estas fechas", que usan /vacaciones (panel de
// planificación y Gantt) y /solicitudes (para decidir un pedido).
import { prisma } from "./prisma";
import { ausentesPorDia, pico, diasEnRango, referenciaMensual, costoEnRango, presupuestoAplica, type ReferenciaMensual, type Ausencia, type Rango } from "./planificacion-reglas";
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

// Costo de referencia de cada legajo: sus últimas liquidaciones vigentes de
// períodos CERRADOS (números firmes), hasta cubrir más o menos un mes, con
// las contribuciones patronales que esas liquidaciones hayan calculado.
async function referencias(legajoIds: string[], pctEstimado: number | null): Promise<Map<string, ReferenciaMensual>> {
  const liquidaciones = await prisma.liquidacion.findMany({
    where: { legajoId: { in: legajoIds }, vigente: true, periodo: { estado: "cerrada" } },
    select: {
      legajoId: true, bruto: true, periodo: { select: { fechaDesde: true, fechaHasta: true } },
      detalle: { where: { excluido: false, concepto: { tipo: "contribucion_patronal" } }, select: { importe: true } },
    },
    orderBy: { periodo: { fechaHasta: "desc" } },
  });
  const porLegajo = new Map<string, { bruto: number; contribuciones: number; dias: number }[]>();
  for (const l of liquidaciones) {
    const lista = porLegajo.get(l.legajoId) ?? [];
    if (lista.reduce((a, x) => a + x.dias, 0) >= 28) continue; // ya tiene un mes de referencia
    lista.push({
      bruto: Number(l.bruto),
      contribuciones: l.detalle.reduce((a, d) => a + Number(d.importe), 0),
      dias: Math.round((l.periodo.fechaHasta.getTime() - l.periodo.fechaDesde.getTime()) / DIA_MS) + 1,
    });
    porLegajo.set(l.legajoId, lista);
  }
  const resultado = new Map<string, ReferenciaMensual>();
  for (const [id, lista] of porLegajo) {
    const ref = referenciaMensual(lista, pctEstimado);
    if (ref) resultado.set(id, ref);
  }
  return resultado;
}

export async function calcularPlan(empresaId: string, r: Rango, centroCostoId: string | null, conCostos: boolean) {
  const [legajos, empresa] = await Promise.all([
    prisma.legajo.findMany({
      where: { empresaId, condicion: "activo", ...(centroCostoId ? { centroCostoId } : {}) },
      select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } },
      orderBy: { numeroLegajo: "asc" },
    }),
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { pctContribucionesEstimado: true } }),
  ]);
  const pct = empresa?.pctContribucionesEstimado != null ? Number(empresa.pctContribucionesEstimado) : null;
  const ausencias = await ausenciasDelRango(empresaId, r, centroCostoId);
  const dias = ausentesPorDia(r, ausencias);
  const diasDelRango = dias.length;

  const refs = conCostos ? await referencias(legajos.map((l) => l.id), pct) : new Map<string, ReferenciaMensual>();
  const personas = legajos.map((l) => {
    const propias = ausencias.filter((a) => a.legajoId === l.id);
    const diasFirmes = propias.filter((a) => !a.pendiente).reduce((s, a) => s + diasEnRango(a, r), 0);
    const diasPendientes = propias.filter((a) => a.pendiente).reduce((s, a) => s + diasEnRango(a, r), 0);
    const ref = refs.get(l.id) ?? null;
    const mensual = ref ? ref.bruto + ref.contribuciones : null;
    return {
      id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, sector: l.centroCosto?.nombre ?? "Sin asignar",
      diasFirmes, diasPendientes, ref,
      costo: mensual !== null
        ? { mensual, firmes: costoEnRango(mensual, diasDelRango, diasFirmes), conPendientes: costoEnRango(mensual, diasDelRango, diasFirmes + diasPendientes) }
        : null,
    };
  });

  const suma = (campo: "firmes" | "conPendientes") => {
    const t = { masaBruta: 0, contribuciones: 0, masa: 0, vacaciones: 0, adicional: 0 };
    for (const p of personas) {
      if (!p.costo || !p.ref) continue;
      t.masaBruta += (p.ref.bruto / 30) * diasDelRango;
      t.contribuciones += (p.ref.contribuciones / 30) * diasDelRango;
      t.masa += p.costo[campo].masa;
      t.vacaciones += p.costo[campo].vacaciones;
      t.adicional += p.costo[campo].adicional;
    }
    return { ...t, total: t.masa + t.adicional };
  };
  const cuantos = (origen: string) => personas.filter((p) => p.ref?.origen === origen).length;

  // Lo que REALMENTE se liquidó en períodos cerrados que tocan el rango —
  // para fechas pasadas, es el dato firme contra el que comparar.
  const liquidado = conCostos
    ? (await prisma.periodo.findMany({
        where: { empresaId, estado: "cerrada", fechaDesde: { lte: r.hasta }, fechaHasta: { gte: r.desde } },
        select: {
          nombre: true, fechaDesde: true, fechaHasta: true,
          liquidaciones: {
            where: { vigente: true, legajoId: { in: legajos.map((l) => l.id) } },
            select: { bruto: true, detalle: { where: { excluido: false, concepto: { tipo: "contribucion_patronal" } }, select: { importe: true } } },
          },
        },
        orderBy: { fechaDesde: "asc" },
      })).map((p) => ({
        nombre: p.nombre, fechaDesde: p.fechaDesde, fechaHasta: p.fechaHasta, legajos: p.liquidaciones.length,
        bruto: p.liquidaciones.reduce((a, l) => a + Number(l.bruto), 0),
        contribuciones: p.liquidaciones.reduce((a, l) => a + l.detalle.reduce((x, d) => x + Number(d.importe), 0), 0),
      }))
    : null;

  const plan = {
    dotacion: legajos.length,
    diasDelRango,
    dias: dias.map((d) => ({ fecha: d.fecha, firmes: d.firmes, conPendientes: d.conPendientes })),
    pico: { firmes: pico(dias, "firmes"), conPendientes: pico(dias, "conPendientes") },
    diasVacaciones: { firmes: personas.reduce((a, p) => a + p.diasFirmes, 0), pendientes: personas.reduce((a, p) => a + p.diasPendientes, 0) },
    personas: personas.filter((p) => p.diasFirmes + p.diasPendientes > 0).map(({ ref, ...p }) => p),
    costos: conCostos
      ? {
          firmes: suma("firmes"), conPendientes: suma("conPendientes"),
          sinSueldo: personas.filter((p) => !p.costo).length,
          contribuciones: { liquidadas: cuantos("liquidadas"), estimadas: cuantos("estimadas"), sin: cuantos("sin"), pctEstimado: pct },
        }
      : null,
    liquidado,
  };
  return { plan, refs };
}

export async function planificar(empresaId: string, r: Rango, centroCostoId: string | null, conCostos: boolean) {
  return (await calcularPlan(empresaId, r, centroCostoId, conCostos)).plan;
}

// Para decidir un pedido: cómo queda cada presupuesto que le corresponde
// (por fechas y sector) hoy, y si se aprueba ESTE pedido. `cache` evita
// recalcular el mismo presupuesto para cada pedido de la bandeja.
export type PlanCalculado = Awaited<ReturnType<typeof calcularPlan>>;
export async function impactoEnPresupuestos(
  empresaId: string,
  pedido: { legajoId: string; centroCostoId: string | null; desde: Date; hasta: Date },
  cache: Map<string, Promise<PlanCalculado>>
) {
  const presupuestos = await prisma.presupuestoSalarial.findMany({
    where: { empresaId, fechaDesde: { lte: pedido.hasta }, fechaHasta: { gte: pedido.desde } },
    include: { centroCosto: { select: { nombre: true } } },
    orderBy: { fechaDesde: "asc" },
  });
  const resultado = [];
  for (const p of presupuestos) {
    const rango = { desde: p.fechaDesde, hasta: p.fechaHasta };
    if (!presupuestoAplica({ centroCostoId: p.centroCostoId, ...rango }, pedido.centroCostoId, pedido)) continue;
    if (!cache.has(p.id)) cache.set(p.id, calcularPlan(empresaId, rango, p.centroCostoId, true));
    const { plan, refs } = await cache.get(p.id)!;
    const ref = refs.get(pedido.legajoId);
    const hoy = plan.costos!.firmes.total;
    const sumaEste = ref ? costoEnRango(ref.bruto + ref.contribuciones, 0, diasEnRango(pedido, rango)).adicional : 0;
    resultado.push({
      id: p.id, fechaDesde: p.fechaDesde, fechaHasta: p.fechaHasta, sector: p.centroCosto?.nombre ?? null,
      importe: Number(p.importe), hoy, conEste: hoy + sumaEste, sinReferencia: !ref,
    });
  }
  return resultado;
}
