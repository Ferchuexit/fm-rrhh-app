// El empleado confirma que leyó una noticia que lo pedía. Un toque, sin
// PIN: es un acuse de lectura, no una firma (para eso están los recibos y
// las constancias del legajo). Queda con fecha, hora e IP.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, ipDelPedido } from "@/lib/portal";
import { noticiaDelEmpleado } from "@/lib/noticias";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const n = await noticiaDelEmpleado(params.id, sesion.legajoId);
    if (!n) return NextResponse.json({ error: "No se encontró esa noticia." }, { status: 404 });
    if (!n.requiereAcuse) return NextResponse.json({ error: "Esta noticia no pide confirmación." }, { status: 400 });

    const ahora = new Date();
    await prisma.noticiaLectura.upsert({ where: { noticiaId_legajoId: { noticiaId: n.id, legajoId: sesion.legajoId } }, create: { noticiaId: n.id, legajoId: sesion.legajoId }, update: {} });
    // Solo si todavía no lo había dado: el primer acuse es el que vale.
    await prisma.noticiaLectura.updateMany({ where: { noticiaId: n.id, legajoId: sesion.legajoId, acuseEn: null }, data: { acuseEn: ahora, ipAcuse: ipDelPedido() } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/portal/noticias/[id]/acuse:", e);
    return NextResponse.json({ error: "No se pudo registrar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
