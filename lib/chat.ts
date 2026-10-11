// FM RRHH — lib/chat.ts
// Lado base de datos del chat interno.
//
// Sobre el alcance: MiembroConversacion es de un legajo (se filtra solo).
// Conversacion y MensajeChat son de la empresa. Las actualizaciones "de
// sistema" sobre la conversación (cuándo fue el último mensaje) van con
// prismaSistema: no dependen de quién escribió.
import { prisma, prismaSistema } from "./prisma";
import { avisar, avisoMensajeChat } from "./avisos";
import { claveDirecta, claveRRHH, limpiarTexto, motivoNoEscribir, participa, participantesDe, puedeVer, tocaNotificar, vistaPrevia } from "./chat-reglas";
export * from "./chat-reglas";

const NOMBRE_RRHH = "RR.HH.";
export const CAMPOS_MENSAJE = { id: true, autorId: true, autorNombre: true, deRRHH: true, texto: true, borradoEn: true, createdAt: true } as const;
type Msj = { id: string; autorId: string | null; autorNombre: string; deRRHH: boolean; texto: string; borradoEn: Date | null; createdAt: Date };
// Lo que sale hacia la pantalla: un mensaje borrado no lleva su texto.
export const mensajePublico = (m: Msj) => ({ id: m.id, autorId: m.autorId, autor: m.autorNombre, deRRHH: m.deRRHH, texto: m.borradoEn ? "" : m.texto, borrado: !!m.borradoEn, cuando: m.createdAt });

async function persona(legajoId: string) {
  const l = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { id: true, empresaId: true, centroCostoId: true, condicion: true, nombre: true, apellido: true, empresa: { select: { chatEntreEmpleados: true } } } });
  return l && l.condicion === "activo" ? l : null;
}

// Las conversaciones de un empleado, la más reciente arriba, con cuántos
// mensajes tiene sin leer en cada una.
export async function conversacionesDe(legajoId: string) {
  const yo = await persona(legajoId);
  if (!yo) return [];
  const filas = await prisma.miembroConversacion.findMany({ where: { legajoId } });
  const porConv = new Map(filas.map((f) => [f.conversacionId, f]));
  const candidatas = await prisma.conversacion.findMany({
    where: { empresaId: yo.empresaId, OR: [{ tipo: "grupo", todos: true }, ...(yo.centroCostoId ? [{ tipo: "grupo", centroCostoIds: { has: yo.centroCostoId } }] : []), { id: { in: filas.filter((f) => f.agregado).map((f) => f.conversacionId) } }, { clave: claveRRHH(legajoId) }, { tipo: "directo", clave: { contains: legajoId } }] },
  });
  const mias = candidatas.filter((c) => puedeVer(c, yo, porConv.get(c.id)) && (c.tipo === "grupo" || c.ultimoMensajeEn));
  // El nombre del otro en las charlas directas.
  const otros = mias.filter((c) => c.tipo === "directo").map((c) => participantesDe(c.clave).find((id) => id !== legajoId)!);
  const nombres = new Map((await prisma.legajo.findMany({ where: { id: { in: otros } }, select: { id: true, nombre: true, apellido: true } })).map((l) => [l.id, `${l.nombre} ${l.apellido}`]));
  // ("autor distinto de mí" a mano: en SQL, un distinto deja afuera los
  // NULL, que acá son los mensajes de RR.HH.)
  const sinLeer = await Promise.all(mias.map((c) => (c.ultimoMensajeEn && (!porConv.get(c.id)?.leidoHasta || porConv.get(c.id)!.leidoHasta! < c.ultimoMensajeEn) ? prisma.mensajeChat.count({ where: { conversacionId: c.id, borradoEn: null, OR: [{ autorId: null }, { autorId: { not: legajoId } }], ...(porConv.get(c.id)?.leidoHasta ? { createdAt: { gt: porConv.get(c.id)!.leidoHasta! } } : {}) } }) : 0)));
  return mias
    .map((c, i) => ({ id: c.id, tipo: c.tipo, titulo: c.tipo === "grupo" ? c.nombre ?? "Grupo" : c.tipo === "rrhh" ? NOMBRE_RRHH : nombres.get(participantesDe(c.clave).find((id) => id !== legajoId)!) ?? "Compañero", emoji: c.tipo === "grupo" ? c.emoji : c.tipo === "rrhh" ? "🧑‍💼" : "👤", soloAnuncios: c.soloAnuncios, ultimo: c.ultimoTexto, ultimoEn: c.ultimoMensajeEn, sinLeer: sinLeer[i] }))
    .sort((a, b) => (b.ultimoEn?.getTime() ?? 0) - (a.ultimoEn?.getTime() ?? 0) || a.titulo.localeCompare(b.titulo));
}
export const chatSinLeer = async (legajoId: string) => (await conversacionesDe(legajoId)).reduce((a, c) => a + c.sinLeer, 0);

// La consulta de un empleado con RR.HH.: se crea la primera vez.
export async function conversacionConRRHH(empresaId: string, legajoId: string) {
  return prismaSistema.conversacion.upsert({ where: { clave: claveRRHH(legajoId) }, create: { empresaId, tipo: "rrhh", empleadoId: legajoId, clave: claveRRHH(legajoId) }, update: {} });
}

// Abre (o encuentra) la charla directa con un compañero.
export async function conversacionDirecta(legajoId: string, otroId: string): Promise<{ error: string; status: number } | { id: string }> {
  const [yo, otro] = await Promise.all([persona(legajoId), persona(otroId)]);
  if (!yo || !otro || yo.empresaId !== otro.empresaId || yo.id === otro.id) return { error: "Esa persona ya no figura en la empresa.", status: 404 };
  if (!yo.empresa.chatEntreEmpleados) return { error: "La empresa desactivó los mensajes entre compañeros. Podés escribirle a RR.HH.", status: 403 };
  const clave = claveDirecta(yo.id, otro.id);
  const c = await prismaSistema.conversacion.upsert({ where: { clave }, create: { empresaId: yo.empresaId, tipo: "directo", clave }, update: {} });
  return { id: c.id };
}

// Una conversación vista por un empleado: null si no es parte.
export async function conversacionPara(conversacionId: string, legajoId: string) {
  const yo = await persona(legajoId);
  const c = yo ? await prisma.conversacion.findFirst({ where: { id: conversacionId, empresaId: yo.empresaId } }) : null;
  if (!yo || !c) return null;
  const fila = await prisma.miembroConversacion.findUnique({ where: { conversacionId_legajoId: { conversacionId, legajoId } } });
  if (!puedeVer(c, yo, fila)) return null;
  const otroId = c.tipo === "directo" ? participantesDe(c.clave).find((id) => id !== legajoId) : null;
  const otro = otroId ? await prisma.legajo.findUnique({ where: { id: otroId }, select: { nombre: true, apellido: true } }) : null;
  return { conv: c, yo, fila, titulo: c.tipo === "grupo" ? c.nombre ?? "Grupo" : c.tipo === "rrhh" ? NOMBRE_RRHH : otro ? `${otro.nombre} ${otro.apellido}` : "Compañero", noEscribe: motivoNoEscribir(c, yo, fila, yo.empresa.chatEntreEmpleados) };
}

// Los mensajes: los últimos 80, o los posteriores a `desde` (lo que pide
// la pantalla cada pocos segundos mientras está abierta).
export async function mensajesDe(conversacionId: string, desde: Date | null) {
  const lista = await prisma.mensajeChat.findMany({ where: { conversacionId, ...(desde ? { createdAt: { gt: desde } } : {}) }, select: CAMPOS_MENSAJE, orderBy: { createdAt: desde ? "asc" : "desc" }, take: desde ? 200 : 80 });
  return (desde ? lista : lista.reverse()).map(mensajePublico);
}

export async function marcarLeido(conversacionId: string, legajoId: string) {
  await prisma.miembroConversacion.upsert({ where: { conversacionId_legajoId: { conversacionId, legajoId } }, create: { conversacionId, legajoId, agregado: false, leidoHasta: new Date() }, update: { leidoHasta: new Date() } });
}

// A quiénes les llega un mensaje (todos los que participan, menos el autor).
async function destinatarios(c: { id: string; empresaId: string; tipo: string; todos: boolean; centroCostoIds: string[]; empleadoId: string | null; clave: string | null }, autorId: string | null): Promise<string[]> {
  let ids: string[];
  if (c.tipo === "rrhh") ids = c.empleadoId ? [c.empleadoId] : [];
  else if (c.tipo === "directo") ids = participantesDe(c.clave);
  else {
    const agregados = (await prismaSistema.miembroConversacion.findMany({ where: { conversacionId: c.id, agregado: true }, select: { legajoId: true } })).map((m) => m.legajoId);
    const porRegla = c.todos || c.centroCostoIds.length ? (await prismaSistema.legajo.findMany({ where: { empresaId: c.empresaId, condicion: "activo", ...(c.todos ? {} : { centroCostoId: { in: c.centroCostoIds } }) }, select: { id: true } })).map((l) => l.id) : [];
    ids = [...new Set([...agregados, ...porRegla])];
  }
  return ids.filter((id) => id !== autorId);
}

// Guarda un mensaje y avisa. `autor`: el empleado que escribe, o null si
// escribe RR.HH. desde el panel (`nombre` es entonces quién de RR.HH.).
export async function enviarMensaje(c: { id: string; empresaId: string; tipo: string; nombre: string | null; todos: boolean; centroCostoIds: string[]; empleadoId: string | null; clave: string | null; ultimoMensajeEn: Date | null }, autor: { id: string; nombre: string } | null, nombreRRHH: string | null, textoCrudo: unknown) {
  const texto = limpiarTexto(textoCrudo);
  if (!texto) return { error: "Escribí un mensaje.", status: 400 as const };
  const autorNombre = autor ? autor.nombre : `${NOMBRE_RRHH}${nombreRRHH ? ` · ${nombreRRHH}` : ""}`.slice(0, 80);
  const m = await prisma.mensajeChat.create({ data: { conversacionId: c.id, autorId: autor?.id ?? null, autorNombre, deRRHH: !autor, texto }, select: CAMPOS_MENSAJE });
  await prismaSistema.conversacion.update({ where: { id: c.id }, data: { ultimoMensajeEn: m.createdAt, ultimoTexto: vistaPrevia(autorNombre, texto, c.tipo === "grupo"), ...(autor ? {} : { leidoRRHHEn: m.createdAt }) } });
  if (autor) await prismaSistema.miembroConversacion.upsert({ where: { conversacionId_legajoId: { conversacionId: c.id, legajoId: autor.id } }, create: { conversacionId: c.id, legajoId: autor.id, agregado: false, leidoHasta: m.createdAt }, update: { leidoHasta: m.createdAt } });
  // Notificación al celular (sin mail), solo a quien estaba al día.
  try {
    const para = await destinatarios(c, autor?.id ?? null);
    const leidos = new Map((await prismaSistema.miembroConversacion.findMany({ where: { conversacionId: c.id, legajoId: { in: para } }, select: { legajoId: true, leidoHasta: true } })).map((f) => [f.legajoId, f.leidoHasta]));
    const avisarA = para.filter((id) => tocaNotificar(leidos.get(id) ?? null, c.ultimoMensajeEn));
    await avisar(avisarA, avisoMensajeChat(c.id, autorNombre, c.tipo === "grupo" ? c.nombre : null), { sinMail: true });
  } catch (e) {
    console.error("Chat: no se pudo avisar:", e);
  }
  return { mensaje: mensajePublico(m) };
}

export { participa };
