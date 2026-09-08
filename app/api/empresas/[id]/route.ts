import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { cuit, razonSocial, nombreFantasia } = await req.json();
    const data: Record<string, any> = {};
    if (cuit !== undefined) data.cuit = cuit.trim();
    if (razonSocial !== undefined) data.razonSocial = razonSocial.trim();
    if (nombreFantasia !== undefined) data.nombreFantasia = nombreFantasia?.trim() || null;

    const empresa = await prisma.empresa.update({ where: { id: params.id }, data });
    return NextResponse.json(empresa);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya existe otra empresa con ese CUIT." }, { status: 409 });
    }
    console.error("Error en PATCH /api/empresas/[id]:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al editar la empresa." }, { status: 500 });
  }
}
