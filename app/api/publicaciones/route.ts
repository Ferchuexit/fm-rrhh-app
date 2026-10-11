// FM RRHH — app/api/publicaciones/route.ts
// Las publicaciones del muro vistas por RR.HH.
//   POST (formulario)            → publica en nombre de la empresa
//   POST accion "aprobar"        → le da el visto bueno a una pendiente
//   POST accion "ocultar"/"mostrar"
//   POST accion "ocultarComentario"/"mostrarComentario"
//   POST accion "config"         → si lo de los empleados espera aprobación
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { avisar } from "@/lib/avisos";
import { publicar, CAMPOS_PUBLICACION } from "@/lib/muro";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [config, lista] = await Promise.all([
      prisma.empresa.findUnique({ where: { id: empresa.id }, select: { muroConAprobacion: true } }),
      prisma.publicacion.findMany({ where: { empresaId: empresa.id }, select: { ...CAMPOS_PUBLICACION, _count: { select: { meGusta: true } }, comentarios: { select: { id: true, autorNombre: true, texto: true, oculto: true, createdAt: true }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    return NextResponse.json({
      conAprobacion: config?.muroConAprobacion ?? false,
      publicaciones: lista.map((p) => ({ id: p.id, autor: p.autorNombre, deRRHH: !p.autorId, texto: p.texto, conFoto: !!p.fotoMime, pendiente: p.pendiente, oculto: p.oculto, createdAt: p.createdAt, meGusta: p._count.meGusta, comentarios: p.comentarios.map((c) => ({ id: c.id, autor: c.autorNombre, texto: c.texto, oculto: c.oculto })) })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/publicaciones:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para el Muro. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar las publicaciones. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });

    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      if (!form) return NextResponse.json({ error: "No llegó la publicación. Si la foto es muy pesada, probá con otra." }, { status: 400 });
      const r = await publicar(empresa.id, null, empresa.nombreFantasia || empresa.razonSocial, form.get("texto"), form.get("foto") instanceof File ? (form.get("foto") as File) : null, false, hoyArgentina());
      return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
    }

    const body = await req.json().catch(() => ({}));
    if (body.accion === "config") {
      await prisma.empresa.update({ where: { id: empresa.id }, data: { muroConAprobacion: body.conAprobacion === true } });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "ocultarComentario" || body.accion === "mostrarComentario") {
      const { count } = await prisma.comentarioPublicacion.updateMany({ where: { id: String(body.id ?? ""), publicacion: { empresaId: empresa.id } }, data: { oculto: body.accion === "ocultarComentario" } });
      return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se encontró ese comentario." }, { status: 404 });
    }
    const p = await prisma.publicacion.findFirst({ where: { id: String(body.id ?? ""), empresaId: empresa.id }, select: { id: true, autorId: true, pendiente: true } });
    if (!p) return NextResponse.json({ error: "No se encontró esa publicación." }, { status: 404 });
    if (body.accion === "aprobar") {
      await prisma.publicacion.update({ where: { id: p.id }, data: { pendiente: false, oculto: false, ocultoPor: null } });
      if (p.pendiente && p.autorId) await avisar([p.autorId], { tipo: "muro", titulo: "Tu publicación ya está en el muro", cuerpo: "RR.HH. le dio el visto bueno. Ya la ven tus compañeros.", url: "/portal/muro" }, { sinMail: true });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "ocultar" || body.accion === "mostrar") {
      const ocultar = body.accion === "ocultar";
      await prisma.publicacion.update({ where: { id: p.id }, data: { oculto: ocultar, ocultoPor: ocultar ? sesion.email : null } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e: any) {
    console.error("Error en POST /api/publicaciones:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
