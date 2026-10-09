// Talles: el único dato de la ficha que el empleado cambia directo, sin
// aprobación — nadie sabe mejor que él qué talle usa.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { validarTalles } from "@/lib/legajo-digital";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const { talleRopa, talleCalzado } = await req.json().catch(() => ({}));
    const error = validarTalles(talleRopa, talleCalzado);
    if (error) return NextResponse.json({ error }, { status: 400 });
    await prisma.legajo.update({ where: { id: sesion.legajoId }, data: { talleRopa: String(talleRopa).trim(), talleCalzado: String(talleCalzado).trim() } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/portal/legajo/talles:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
