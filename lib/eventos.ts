// FM RRHH — lib/eventos.ts
// Lado base de datos de los eventos de la empresa.
import { prisma } from "./prisma";
import { leCorresponde, validarRespuesta } from "./eventos-reglas";
export * from "./eventos-reglas";

// A quiénes les corresponde: activos de la empresa, de los sectores
// elegidos (o todos).
export const filtroInvitados = (e: { empresaId: string; centroCostoIds: string[] }) => ({ empresaId: e.empresaId, condicion: "activo", ...(e.centroCostoIds.length ? { centroCostoId: { in: e.centroCostoIds } } : {}) });

// Los eventos que ve una persona en el portal: los que vienen (publicados,
// o cancelados para que se entere) y le corresponden, con su respuesta.
export async function eventosDe(legajoId: string, hoy: Date) {
  const legajo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true, condicion: true } });
  if (!legajo || legajo.condicion !== "activo") return [];
  const eventos = (await prisma.evento.findMany({ where: { empresaId: legajo.empresaId, estado: { in: ["publicado", "cancelado"] }, fecha: { gte: hoy } }, orderBy: [{ fecha: "asc" }, { hora: "asc" }] })).filter((e) => leCorresponde(e, legajo.centroCostoId));
  if (eventos.length === 0) return [];
  const respuestas = await prisma.asistenciaEvento.findMany({ where: { eventoId: { in: eventos.map((e) => e.id) } }, select: { eventoId: true, legajoId: true, va: true, acompanantes: true } });
  return eventos.map((e) => {
    const suyas = respuestas.filter((r) => r.eventoId === e.id);
    const ocupados = suyas.reduce((a, r) => a + (r.va ? 1 + r.acompanantes : 0), 0);
    return { ...e, mia: suyas.find((r) => r.legajoId === legajoId) ?? null, van: suyas.filter((r) => r.va).length, quedan: e.cupo === null ? null : Math.max(0, e.cupo - ocupados) };
  });
}

// Cuántos eventos le falta responder (el globito del portal).
export const eventosSinResponder = async (legajoId: string, hoy: Date) => (await eventosDe(legajoId, hoy)).filter((e) => e.estado === "publicado" && e.pideConfirmacion && !e.mia && (e.limiteConfirmar ?? e.fecha) >= hoy).length;

// Guarda la respuesta de una persona (o la cambia).
export async function responderEvento(eventoId: string, legajoId: string, entrada: unknown, hoy: Date): Promise<{ error: string; status: number } | { ok: true }> {
  const legajo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true, condicion: true } });
  const evento = legajo ? await prisma.evento.findFirst({ where: { id: eventoId, empresaId: legajo.empresaId } }) : null;
  if (!legajo || legajo.condicion !== "activo" || !evento || !leCorresponde(evento, legajo.centroCostoId)) return { error: "No se encontró ese evento.", status: 404 };
  const otras = await prisma.asistenciaEvento.findMany({ where: { eventoId, legajoId: { not: legajoId } }, select: { va: true, acompanantes: true } });
  const { respuesta, error } = validarRespuesta(entrada, evento, otras, hoy);
  if (!respuesta) return { error: error!, status: 400 };
  await prisma.asistenciaEvento.upsert({ where: { eventoId_legajoId: { eventoId, legajoId } }, create: { eventoId, legajoId, ...respuesta }, update: { ...respuesta, respondioEn: new Date() } });
  return { ok: true };
}
