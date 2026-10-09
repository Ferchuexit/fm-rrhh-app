// FM RRHH — app/api/portal/cambiar-pin/route.ts
// El empleado elige su PIN propio. Obligatorio en el primer ingreso (el
// PIN temporal lo conoce RR.HH.), y disponible después cuando quiera.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verificarPassword } from "@/lib/auth";
import { obtenerSesionPortal, cookieSesionPortal, validarPinNuevo, soloDigitos } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pinActual = soloDigitos(body.pinActual);
    const pinNuevo = soloDigitos(body.pinNuevo);

    const acceso = await prisma.accesoPortal.findUnique({ where: { legajoId: sesion.legajoId }, include: { legajo: true } });
    if (!acceso || !acceso.activo) return NextResponse.json({ error: "Tu acceso al portal no está activo. Consultá con RR.HH." }, { status: 403 });

    if (!(await verificarPassword(pinActual, acceso.pinHash))) {
      return NextResponse.json({ error: "El PIN actual no es correcto." }, { status: 401 });
    }
    const motivo = validarPinNuevo(pinNuevo, acceso.legajo.cuil);
    if (motivo) return NextResponse.json({ error: motivo }, { status: 400 });
    if (pinNuevo === pinActual) return NextResponse.json({ error: "El PIN nuevo tiene que ser distinto del actual." }, { status: 400 });

    await prisma.accesoPortal.update({
      where: { id: acceso.id },
      data: { pinHash: await hashPassword(pinNuevo), debeCambiarPin: false, intentosFallidos: 0, bloqueadoHasta: null },
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(await cookieSesionPortal({ ...sesion, debeCambiarPin: false }));
    return res;
  } catch (e: any) {
    console.error("Error en POST /api/portal/cambiar-pin:", e);
    return NextResponse.json({ error: "No se pudo cambiar el PIN. Probá de nuevo en un momento." }, { status: 500 });
  }
}
