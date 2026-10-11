// FM RRHH — app/api/portal/epp/route.ts
// El empleado confirma, desde el portal, que recibió lo que le entregaron.
// Es la constancia: queda la fecha, la hora y desde dónde lo hizo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, ipDelPedido } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    // Firma solo lo que vio en pantalla: si mientras tanto le cargaron otra
    // entrega, esa no queda firmada sin que la haya leído.
    const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : [];
    if (ids.length === 0) return NextResponse.json({ error: "No hay nada para confirmar." }, { status: 400 });
    const { count } = await prisma.entregaEpp.updateMany({ where: { id: { in: ids }, legajoId: sesion.legajoId, firmadoEn: null }, data: { firmadoEn: new Date(), firmaIp: ipDelPedido() } });
    if (count === 0) return NextResponse.json({ error: "Eso ya estaba confirmado." }, { status: 409 });
    return NextResponse.json({ ok: true, confirmadas: count });
  } catch (e) {
    console.error("Error en POST /api/portal/epp:", e);
    return NextResponse.json({ error: "No se pudo confirmar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
