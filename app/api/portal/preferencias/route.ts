// Preferencias del empleado sobre lo que se muestra de él a los compañeros.
// Por ahora, una: que su cumpleaños no aparezca en el muro.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (typeof body.ocultarCumple !== "boolean") return NextResponse.json({ error: "Dato inválido." }, { status: 400 });
    await prisma.legajo.update({ where: { id: sesion.legajoId }, data: { ocultarCumple: body.ocultarCumple } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/preferencias:", e);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
