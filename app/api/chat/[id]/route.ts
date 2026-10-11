// FM RRHH — app/api/chat/[id]/route.ts
// Una conversación vista por RR.HH. (un grupo o la consulta de un empleado;
// nunca una charla directa entre compañeros).
//   GET ?desde=        → mensajes (y, la primera vez, quiénes son parte)
//   POST { texto }     → escribe como RR.HH.
//   POST accion "borrar"   → saca un mensaje (moderación)
//   POST accion "miembros" → agrega / quita gente a mano, o marca encargados
import { NextResponse } from "next/server";
import { prisma, prismaSistema, sectoresDelUsuarioActual } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { mensajesDe, enviarMensaje } from "@/lib/chat";

export const dynamic = "force-dynamic";
const falla = (e: any, donde: string) => {
  console.error(`Error en ${donde} /api/chat/[id]:`, e);
  return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo completar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
};

// La conversación, si este usuario la puede ver.
async function buscar(id: string, empresaId: string) {
  const c = await prisma.conversacion.findFirst({ where: { id, empresaId, tipo: { in: ["grupo", "rrhh"] } } });
  if (!c) return null;
  // Una consulta es de una persona: quien está limitado a sectores solo ve
  // las de su gente (prisma.legajo ya viene filtrado).
  if (c.tipo === "rrhh" && !(await prisma.legajo.findFirst({ where: { id: c.empleadoId ?? "" }, select: { id: true } }))) return null;
  return c;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const c = await buscar(params.id, empresa.id);
    if (!c) return NextResponse.json({ error: "No se encontró esa conversación." }, { status: 404 });
    const txt = new URL(req.url).searchParams.get("desde");
    const desde = txt && !Number.isNaN(Date.parse(txt)) ? new Date(txt) : null;
    const mensajes = await mensajesDe(c.id, desde);
    if (c.tipo === "rrhh" && (!desde || mensajes.length > 0)) await prismaSistema.conversacion.update({ where: { id: c.id }, data: { leidoRRHHEn: new Date() } });
    if (desde) return NextResponse.json({ mensajes });
    const miembros = c.tipo === "grupo" ? await prisma.miembroConversacion.findMany({ where: { conversacionId: c.id, agregado: true }, select: { legajoId: true, admin: true } }) : [];
    return NextResponse.json({ mensajes, miembros });
  } catch (e) { return falla(e, "GET"); }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const c = await buscar(params.id, empresa.id);
    if (!c) return NextResponse.json({ error: "No se encontró esa conversación." }, { status: 404 });
    const body = await req.json().catch(() => ({}));

    if (body.accion === "borrar") {
      const { count } = await prisma.mensajeChat.updateMany({ where: { id: String(body.mensajeId ?? ""), conversacionId: c.id, borradoEn: null }, data: { borradoEn: new Date() } });
      return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se encontró ese mensaje." }, { status: 404 });
    }
    if (body.accion === "miembros") {
      if (c.tipo !== "grupo") return NextResponse.json({ error: "Solo los grupos tienen miembros." }, { status: 400 });
      if ((await sectoresDelUsuarioActual()) !== null) return NextResponse.json({ error: "Los grupos los maneja RR.HH." }, { status: 403 });
      const legajo = await prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true } });
      if (!legajo) return NextResponse.json({ error: "No se encontró esa persona." }, { status: 404 });
      const clave = { conversacionId_legajoId: { conversacionId: c.id, legajoId: legajo.id } };
      if (body.quitar === true) {
        // No se borra la fila: guarda hasta dónde leyó, por si sigue en el
        // grupo por su sector.
        await prisma.miembroConversacion.updateMany({ where: { conversacionId: c.id, legajoId: legajo.id }, data: { agregado: false, admin: false } });
      } else {
        const admin = body.admin === true;
        await prisma.miembroConversacion.upsert({ where: clave, create: { conversacionId: c.id, legajoId: legajo.id, agregado: true, admin }, update: { agregado: true, admin } });
      }
      return NextResponse.json({ ok: true });
    }
    if (c.tipo === "grupo" && c.archivada) return NextResponse.json({ error: "Ese grupo está archivado. Reactivalo para escribir." }, { status: 409 });
    const r = await enviarMensaje(c, null, sesion.nombre, body.texto);
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e) { return falla(e, "POST"); }
}
