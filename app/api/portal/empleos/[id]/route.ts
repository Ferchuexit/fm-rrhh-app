// FM RRHH — app/api/portal/empleos/[id]/route.ts
// Un empleado se postula a una búsqueda interna. Los datos salen de su
// legajo: no completa nada, solo (si quiere) un mensaje.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { registrarPostulacion } from "@/lib/reclutamiento";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const [busqueda, legajo] = await Promise.all([
      prisma.busqueda.findFirst({ where: { id: params.id, empresaId: sesion.empresaId, estado: "abierta", interna: true }, select: { id: true } }),
      prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { apellido: true, nombre: true, email: true, telefono: true, localidad: true, condicion: true } }),
    ]);
    if (!busqueda || !legajo || legajo.condicion !== "activo") return NextResponse.json({ error: "Esa búsqueda ya no recibe postulaciones." }, { status: 409 });
    const r = await registrarPostulacion(prisma, busqueda.id, { apellido: legajo.apellido, nombre: legajo.nombre, email: null, telefono: null, localidad: legajo.localidad, mensaje: String(body.mensaje ?? "").trim().slice(0, 1500) || null }, { fuente: "interno", empleadoId: sesion.legajoId });
    if (r === "repetida") return NextResponse.json({ error: "Ya te habías postulado a esta búsqueda." }, { status: 409 });
    if (r === "llena") return NextResponse.json({ error: "Esa búsqueda ya no recibe postulaciones." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/empleos/[id]:", e);
    return NextResponse.json({ error: "No se pudo enviar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
