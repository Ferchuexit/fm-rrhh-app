// FM RRHH — lib/agenda.ts
// Arma la agenda leyendo de los otros módulos. Cada fuente va en su try: si
// una falla (una tabla que falta en esa base), el resto se muestra igual.
import { prisma } from "./prisma";
import { personasConFechas } from "./cultura";
import { leCorresponde } from "./eventos-reglas";
import { festejosEnRango, tocaElRango, type ItemAgenda } from "./agenda-reglas";
export * from "./agenda-reglas";

const nombre = (l: { nombre: string; apellido: string }) => `${l.nombre} ${l.apellido}`;
async function fuente(lista: ItemAgenda[], hacer: () => Promise<ItemAgenda[]>) {
  try { lista.push(...(await hacer())); } catch (e) { console.error("Agenda: falló una fuente:", (e as Error)?.message); }
}
const pisa = (desde: Date, hasta: Date) => ({ fechaDesde: { lte: hasta }, fechaHasta: { gte: desde } });

// La agenda de la empresa, para RR.HH. (El alcance del usuario ya filtra
// vacaciones y permisos a su gente.)
export async function agendaEmpresa(empresaId: string, desde: Date, hasta: Date): Promise<ItemAgenda[]> {
  const items: ItemAgenda[] = [];
  const enRango = { gte: desde, lte: hasta };
  await fuente(items, async () => (await prisma.evento.findMany({ where: { empresaId, estado: { in: ["borrador", "publicado"] }, fecha: enRango } })).map((e) => ({ clave: `ev-${e.id}`, tipo: "evento", fecha: e.fecha, hasta: null, hora: e.hora, titulo: e.titulo + (e.estado === "borrador" ? " (borrador)" : ""), detalle: e.lugar, url: "/eventos" })));
  await fuente(items, async () => (await prisma.capacitacion.findMany({ where: { empresaId, estado: { not: "cancelada" }, fecha: enRango }, include: { _count: { select: { asistentes: true } } } })).map((c) => ({ clave: `cap-${c.id}`, tipo: "capacitacion", fecha: c.fecha, hasta: null, hora: null, titulo: c.titulo, detalle: [c.lugar, `${c._count.asistentes} ${c._count.asistentes === 1 ? "persona" : "personas"}`].filter(Boolean).join(" · "), url: "/capacitaciones" })));
  await fuente(items, async () => (await prisma.feriado.findMany({ where: { empresaId, fecha: enRango } })).map((f) => ({ clave: `fer-${f.id}`, tipo: "feriado", fecha: f.fecha, hasta: null, hora: null, titulo: f.nombre, detalle: null, url: null })));
  await fuente(items, async () => (await prisma.vacacion.findMany({ where: { legajo: { empresaId }, ...pisa(desde, hasta) }, include: { legajo: { select: { nombre: true, apellido: true, centroCosto: { select: { nombre: true } } } } } })).map((v) => ({ clave: `vac-${v.id}`, tipo: "vacaciones", fecha: v.fechaDesde, hasta: v.fechaHasta, hora: null, titulo: nombre(v.legajo), detalle: v.legajo.centroCosto?.nombre ?? null, url: "/vacaciones" })));
  await fuente(items, async () => (await prisma.solicitudAusencia.findMany({ where: { legajo: { empresaId }, tipo: "permiso", estado: "aprobada", ...pisa(desde, hasta) }, include: { legajo: { select: { nombre: true, apellido: true, centroCosto: { select: { nombre: true } } } } } })).map((s) => ({ clave: `per-${s.id}`, tipo: "permiso", fecha: s.fechaDesde, hasta: s.fechaHasta, hora: null, titulo: nombre(s.legajo), detalle: s.legajo.centroCosto?.nombre ?? null, url: "/solicitudes" })));
  await fuente(items, async () => festejosEnRango(await personasConFechas(empresaId), desde, hasta, false).map((f) => ({ ...f, url: "/celebraciones" })));
  await fuente(items, async () => (await prisma.encuesta.findMany({ where: { empresaId, estado: "abierta", fechaCierre: enRango } })).map((e) => ({ clave: `enc-${e.id}`, tipo: "limite", fecha: e.fechaCierre, hasta: null, hora: null, titulo: `Cierra la encuesta: ${e.titulo}`, detalle: null, url: "/encuestas" })));
  await fuente(items, async () => (await prisma.cicloEvaluacion.findMany({ where: { empresaId, estado: "abierto", fechaLimite: enRango } })).map((c) => ({ clave: `eval-${c.id}`, tipo: "limite", fecha: c.fechaLimite, hasta: null, hora: null, titulo: `Vence la evaluación: ${c.nombre}`, detalle: null, url: "/evaluaciones" })));
  await fuente(items, async () => (await prisma.evento.findMany({ where: { empresaId, estado: "publicado", pideConfirmacion: true, limiteConfirmar: enRango } })).map((e) => ({ clave: `evlim-${e.id}`, tipo: "limite", fecha: e.limiteConfirmar!, hasta: null, hora: null, titulo: `Último día para confirmar: ${e.titulo}`, detalle: null, url: "/eventos" })));
  return items;
}

// La agenda de UNA persona en el portal: lo suyo, lo de su equipo si tiene
// gente a cargo, y lo que es de todos (feriados, festejos, eventos).
export async function agendaDe(legajoId: string, desde: Date, hasta: Date): Promise<ItemAgenda[]> {
  const yo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true, condicion: true } });
  if (!yo || yo.condicion !== "activo") return [];
  const items: ItemAgenda[] = [];
  const enRango = { gte: desde, lte: hasta };
  await fuente(items, async () => {
    const eventos = (await prisma.evento.findMany({ where: { empresaId: yo.empresaId, estado: "publicado", fecha: enRango } })).filter((e) => leCorresponde(e, yo.centroCostoId));
    const mias = new Map((await prisma.asistenciaEvento.findMany({ where: { legajoId, eventoId: { in: eventos.map((e) => e.id) } } })).map((r) => [r.eventoId, r.va]));
    return eventos.map((e) => ({ clave: `ev-${e.id}`, tipo: "evento" as const, fecha: e.fecha, hasta: null, hora: e.hora, titulo: e.titulo, detalle: [e.lugar, !e.pideConfirmacion ? null : mias.get(e.id) === true ? "Confirmaste que vas" : mias.get(e.id) === false ? "Avisaste que no vas" : "Falta que confirmes"].filter(Boolean).join(" · ") || null, url: "/portal/eventos" }));
  });
  await fuente(items, async () => (await prisma.capacitacion.findMany({ where: { empresaId: yo.empresaId, estado: { not: "cancelada" }, fecha: enRango, asistentes: { some: { legajoId } } } })).map((c) => ({ clave: `cap-${c.id}`, tipo: "capacitacion", fecha: c.fecha, hasta: null, hora: null, titulo: c.titulo, detalle: [c.lugar, c.instructor].filter(Boolean).join(" · ") || null, url: "/portal/capacitaciones" })));
  await fuente(items, async () => (await prisma.feriado.findMany({ where: { empresaId: yo.empresaId, fecha: enRango } })).map((f) => ({ clave: `fer-${f.id}`, tipo: "feriado", fecha: f.fecha, hasta: null, hora: null, titulo: f.nombre, detalle: null, url: null })));
  // Vacaciones y permisos: los míos, y los de mi equipo (sin el motivo).
  const deQuien = { OR: [{ legajoId }, { legajo: { jefeId: legajoId, condicion: "activo" } }] };
  const rotulo = (l: { id?: string; nombre: string; apellido: string }, que: string, mio: boolean) => (mio ? `Mis ${que}` : `${nombre(l)}: ${que}`);
  await fuente(items, async () => (await prisma.vacacion.findMany({ where: { ...deQuien, ...pisa(desde, hasta) }, include: { legajo: { select: { nombre: true, apellido: true } } } })).map((v) => ({ clave: `vac-${v.id}`, tipo: "vacaciones", fecha: v.fechaDesde, hasta: v.fechaHasta, hora: null, titulo: rotulo(v.legajo, "vacaciones", v.legajoId === legajoId), detalle: v.legajoId === legajoId ? null : "De tu equipo", url: v.legajoId === legajoId ? "/portal/vacaciones" : "/portal/equipo" })));
  await fuente(items, async () => (await prisma.solicitudAusencia.findMany({ where: { ...deQuien, tipo: "permiso", estado: "aprobada", ...pisa(desde, hasta) }, include: { legajo: { select: { nombre: true, apellido: true } } } })).map((s) => ({ clave: `per-${s.id}`, tipo: "permiso", fecha: s.fechaDesde, hasta: s.fechaHasta, hora: null, titulo: s.legajoId === legajoId ? "Mi permiso" : `${nombre(s.legajo)}: permiso`, detalle: s.legajoId === legajoId ? null : "De tu equipo", url: s.legajoId === legajoId ? "/portal/vacaciones" : "/portal/equipo" })));
  await fuente(items, async () => festejosEnRango(await personasConFechas(yo.empresaId), desde, hasta, true).map((f) => ({ ...f, url: "/portal/muro" })));
  await fuente(items, async () => (await prisma.encuesta.findMany({ where: { empresaId: yo.empresaId, estado: "abierta", fechaCierre: enRango, participaciones: { none: { legajoId } } } })).filter((e) => e.centroCostoIds.length === 0 || (yo.centroCostoId !== null && e.centroCostoIds.includes(yo.centroCostoId))).map((e) => ({ clave: `enc-${e.id}`, tipo: "limite", fecha: e.fechaCierre, hasta: null, hora: null, titulo: "Último día para responder la encuesta", detalle: e.titulo, url: "/portal/encuestas" })));
  return items.filter((i) => tocaElRango(i, desde, hasta));
}
