import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH: cierra la vigencia (le pone vigenciaHasta) en vez de borrarla —
// así queda registro de que esa persona FUE carga de familia hasta tal
// fecha, útil si algún día hay que auditar un período viejo.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { vigenciaHasta } = await req.json();
    const carga = await prisma.cargaFamiliarGanancias.update({
      where: { id: params.id },
      data: { vigenciaHasta: vigenciaHasta ? new Date(vigenciaHasta) : new Date() },
    });
    return NextResponse.json(carga);
  } catch (e: any) {
    console.error("Error en PATCH /api/cargas-familia/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo cerrar la carga de familia." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.cargaFamiliarGanancias.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/cargas-familia/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo borrar la carga de familia." }, { status: 500 });
  }
}
