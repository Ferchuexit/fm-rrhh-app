// FM RRHH — app/api/portal/reconocimientos/route.ts
// Un empleado reconoce a un compañero desde el portal.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { reconocer } from "@/lib/cultura";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const yo = await prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { nombre: true, apellido: true, condicion: true } });
    if (!yo || yo.condicion !== "activo") return NextResponse.json({ error: "No se pudo enviar." }, { status: 403 });
    const r = await reconocer(sesion.empresaId, await req.json().catch(() => ({})), { id: sesion.legajoId, nombre: yo.nombre }, `${yo.nombre} ${yo.apellido}`, hoyArgentina());
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e) {
    console.error("Error en POST /api/portal/reconocimientos:", e);
    return NextResponse.json({ error: "No se pudo enviar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
