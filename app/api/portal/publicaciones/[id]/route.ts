// FM RRHH — app/api/portal/publicaciones/[id]/route.ts
// Sobre una publicación del muro, desde el portal:
//   POST { accion: "megusta" } → pone o saca su "me gusta"
//   POST { comentario }        → comenta
//   POST { accion: "borrar" }  → borra la suya
//   POST { accion: "borrarComentario", comentarioId } → borra su comentario
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { avisar } from "@/lib/avisos";
import { limpiarComentario, visibleEnMuro } from "@/lib/muro";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const p = await prisma.publicacion.findFirst({ where: { id: params.id, empresaId: sesion.empresaId }, select: { id: true, autorId: true, oculto: true, pendiente: true } });
    if (!p || !visibleEnMuro(p, sesion.legajoId)) return NextResponse.json({ error: "Esa publicación ya no está." }, { status: 404 });

    if (body.accion === "borrar") {
      if (p.autorId !== sesion.legajoId) return NextResponse.json({ error: "Solo podés borrar lo que publicaste vos." }, { status: 403 });
      await prisma.publicacion.delete({ where: { id: p.id } });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "borrarComentario") {
      const { count } = await prisma.comentarioPublicacion.deleteMany({ where: { id: String(body.comentarioId ?? ""), publicacionId: p.id, autorId: sesion.legajoId } });
      return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Solo podés borrar tus comentarios." }, { status: 403 });
    }
    // Lo que sigue necesita que ya esté a la vista de todos.
    if (p.pendiente) return NextResponse.json({ error: "Todavía está esperando el visto bueno de RR.HH." }, { status: 409 });
    if (body.accion === "megusta") {
      const clave = { publicacionId_legajoId: { publicacionId: p.id, legajoId: sesion.legajoId } };
      const ya = await prisma.meGustaPublicacion.findUnique({ where: clave });
      if (ya) await prisma.meGustaPublicacion.delete({ where: clave });
      else await prisma.meGustaPublicacion.create({ data: { publicacionId: p.id, legajoId: sesion.legajoId } }).catch((e) => { if (e?.code !== "P2002") throw e; });
      return NextResponse.json({ ok: true, puesto: !ya, total: await prisma.meGustaPublicacion.count({ where: { publicacionId: p.id } }) });
    }
    const texto = limpiarComentario(body.comentario);
    if (!texto) return NextResponse.json({ error: "Escribí el comentario." }, { status: 400 });
    const yo = await prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { nombre: true, apellido: true, condicion: true } });
    if (!yo || yo.condicion !== "activo") return NextResponse.json({ error: "No se pudo comentar." }, { status: 403 });
    const c = await prisma.comentarioPublicacion.create({ data: { publicacionId: p.id, autorId: sesion.legajoId, autorNombre: `${yo.nombre} ${yo.apellido}`, texto } });
    // Al autor, solo al celular y sin el texto.
    if (p.autorId && p.autorId !== sesion.legajoId) await avisar([p.autorId], { tipo: "muro", titulo: "Comentaron tu publicación", cuerpo: `${yo.nombre} ${yo.apellido} comentó lo que publicaste en el muro.`, url: "/portal/muro" }, { sinMail: true });
    return NextResponse.json({ ok: true, comentario: { id: c.id, autorId: c.autorId, autor: c.autorNombre, texto: c.texto } });
  } catch (e) {
    console.error("Error en POST /api/portal/publicaciones/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
