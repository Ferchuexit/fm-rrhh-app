import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH: da de baja el embargo (activo=false, con fecha de fin) — no se
// borra, para que el histórico de "tuvo este embargo hasta tal fecha"
// quede disponible si hace falta auditar un período viejo.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { fechaFin } = await req.json();
    const embargo = await prisma.embargo.update({
      where: { id: params.id },
      data: { activo: false, fechaFin: fechaFin ? new Date(fechaFin) : new Date() },
    });
    return NextResponse.json(embargo);
  } catch (e: any) {
    console.error("Error en PATCH /api/embargos/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo dar de baja el embargo." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.embargo.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/embargos/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo borrar el embargo — si ya tiene cuotas cargadas, dalo de baja en vez de borrarlo." }, { status: 500 });
  }
}
