import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.novedad.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/novedades/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo borrar la novedad." }, { status: 500 });
  }
}
