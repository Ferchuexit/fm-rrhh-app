// El empleado confirma, desde el portal, que recibió una capacitación. Es
// la constancia: queda la fecha, la hora y desde dónde lo hizo. Solo vale
// para una capacitación ya realizada y a la que figura como presente.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, ipDelPedido } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const { count } = await prisma.asistenteCapacitacion.updateMany({
      where: { capacitacionId: params.id, legajoId: sesion.legajoId, asistio: true, firmadoEn: null, capacitacion: { estado: "realizada" } },
      data: { firmadoEn: new Date(), firmaIp: ipDelPedido() },
    });
    if (count === 0) return NextResponse.json({ error: "Esa capacitación ya la confirmaste, o no figurás como presente. Si es un error, avisale a RR.HH." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/capacitaciones/[id]:", e);
    return NextResponse.json({ error: "No se pudo confirmar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
