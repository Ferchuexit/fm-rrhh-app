import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const cuota = await prisma.cuotaEmbargo.findUnique({ where: { id: params.id } });
    if (!cuota) return NextResponse.json({ error: "No se encontró la cuota." }, { status: 404 });
    if (cuota.aplicado) {
      return NextResponse.json({ error: "Esta cuota ya se descontó en una liquidación real — no se puede borrar (evita que quede un desfasaje entre lo liquidado y lo registrado)." }, { status: 400 });
    }
    await prisma.cuotaEmbargo.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/cuotas-embargo/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo borrar la cuota." }, { status: 500 });
  }
}
