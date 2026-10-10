// Cancelar un ingreso en curso (se cargó por error, o la persona no entró).
// No se borra: queda como cancelado, con sus tareas, por si hay que mirarlo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { accion } = await req.json().catch(() => ({}));
    if (accion !== "cancelar") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    const { count } = await prisma.ingreso.updateMany({ where: { id: params.id, estado: "en_curso", legajo: { empresaId: empresa.id } }, data: { estado: "cancelado", cerradoEn: new Date() } });
    if (count === 0) return NextResponse.json({ error: "Ese ingreso ya estaba cerrado o no existe." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/onboarding/[id]:", e);
    return NextResponse.json({ error: "No se pudo cancelar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
