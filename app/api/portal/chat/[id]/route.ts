// FM RRHH — app/api/portal/chat/[id]/route.ts
// Una conversación del empleado.
//   GET ?desde=<fecha> → los mensajes (los nuevos desde esa fecha) y la marca como leída
//   POST { texto }     → escribe
//   POST { borrar }    → borra un mensaje propio
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { conversacionPara, mensajesDe, marcarLeido, enviarMensaje } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const c = await conversacionPara(params.id, sesion.legajoId);
    if (!c) return NextResponse.json({ error: "No se encontró esa conversación." }, { status: 404 });
    const txt = new URL(req.url).searchParams.get("desde");
    const desde = txt && !Number.isNaN(Date.parse(txt)) ? new Date(txt) : null;
    const mensajes = await mensajesDe(c.conv.id, desde);
    if (!desde || mensajes.length > 0) await marcarLeido(c.conv.id, sesion.legajoId);
    return NextResponse.json({ mensajes, noEscribe: c.noEscribe });
  } catch (e) {
    console.error("Error en GET /api/portal/chat/[id]:", e);
    return NextResponse.json({ error: "No se pudieron cargar los mensajes." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const c = await conversacionPara(params.id, sesion.legajoId);
    if (!c) return NextResponse.json({ error: "No se encontró esa conversación." }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    if (body.borrar) {
      const { count } = await prisma.mensajeChat.updateMany({ where: { id: String(body.borrar), conversacionId: c.conv.id, autorId: sesion.legajoId, borradoEn: null }, data: { borradoEn: new Date() } });
      return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Solo podés borrar tus mensajes." }, { status: 403 });
    }
    if (c.noEscribe) return NextResponse.json({ error: c.noEscribe }, { status: 403 });
    const r = await enviarMensaje(c.conv, { id: c.yo.id, nombre: `${c.yo.nombre} ${c.yo.apellido}` }, null, body.texto);
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e) {
    console.error("Error en POST /api/portal/chat/[id]:", e);
    return NextResponse.json({ error: "No se pudo enviar. Probá de nuevo." }, { status: 500 });
  }
}
