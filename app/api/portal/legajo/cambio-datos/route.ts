// El empleado PROPONE un cambio en sus datos (domicilio, teléfono...). No
// toca la ficha: queda pendiente hasta que RR.HH. lo apruebe.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { armarCambios } from "@/lib/legajo-digital";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

    const yaHay = await prisma.solicitudCambioDatos.count({ where: { legajoId: sesion.legajoId, estado: "pendiente" } });
    if (yaHay > 0) return NextResponse.json({ error: "Ya tenés un cambio de datos esperando respuesta de RR.HH." }, { status: 409 });

    const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: sesion.legajoId } });
    const { cambios, error } = armarCambios(legajo as any, await req.json().catch(() => ({})));
    if (error) return NextResponse.json({ error }, { status: 400 });

    await prisma.solicitudCambioDatos.create({ data: { legajoId: sesion.legajoId, cambios } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/portal/legajo/cambio-datos:", e);
    return NextResponse.json({ error: "No se pudo enviar el cambio. Probá de nuevo en un momento." }, { status: 500 });
  }
}
