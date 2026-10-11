// FM RRHH — app/api/portal/publicaciones/route.ts
// Un empleado publica en el muro: un texto y, si quiere, una foto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { publicar } from "@/lib/muro";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "No llegó la publicación. Si la foto es muy pesada, probá con otra." }, { status: 400 });
    const yo = await prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { nombre: true, apellido: true, condicion: true, empresa: { select: { muroConAprobacion: true } } } });
    if (!yo || yo.condicion !== "activo") return NextResponse.json({ error: "No se pudo publicar." }, { status: 403 });
    const r = await publicar(sesion.empresaId, { id: sesion.legajoId }, `${yo.nombre} ${yo.apellido}`, form.get("texto"), form.get("foto") instanceof File ? (form.get("foto") as File) : null, yo.empresa.muroConAprobacion, hoyArgentina());
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e) {
    console.error("Error en POST /api/portal/publicaciones:", e);
    return NextResponse.json({ error: "No se pudo publicar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
