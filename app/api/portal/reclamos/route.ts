// FM RRHH — app/api/portal/reclamos/route.ts
// El empleado reclama algo de un recibo desde el portal.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { avisarARRHH } from "@/lib/avisos";
import { crearReclamo } from "@/lib/reclamos";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const r = await crearReclamo(sesion.legajoId, sesion.empresaId, body);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const yo = await prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { apellido: true, nombre: true, centroCostoId: true } });
    if (yo) await avisarARRHH(sesion.empresaId, yo.centroCostoId, "reclamos", { tipo: "reclamo", titulo: `Reclamo de haberes: ${yo.apellido}, ${yo.nombre}`, cuerpo: "Hizo un reclamo sobre su recibo desde el portal. Está esperando tu respuesta.", url: "/reclamos" });
    return NextResponse.json(r);
  } catch (e) {
    console.error("Error en POST /api/portal/reclamos:", e);
    return NextResponse.json({ error: "No se pudo enviar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
