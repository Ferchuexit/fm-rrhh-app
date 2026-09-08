import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const empresas = await prisma.empresa.findMany({
    orderBy: { razonSocial: "asc" },
    include: { _count: { select: { legajos: true, periodos: true } } },
  });
  return NextResponse.json(empresas);
}

export async function POST(req: Request) {
  try {
    const { cuit, razonSocial, nombreFantasia } = await req.json();
    if (!cuit?.trim() || !razonSocial?.trim()) {
      return NextResponse.json({ error: "Faltan CUIT o razón social." }, { status: 400 });
    }
    const empresa = await prisma.empresa.create({
      data: { cuit: cuit.trim(), razonSocial: razonSocial.trim(), nombreFantasia: nombreFantasia?.trim() || null },
    });
    return NextResponse.json(empresa);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una empresa con ese CUIT." }, { status: 409 });
    }
    console.error("Error en POST /api/empresas:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al crear la empresa." }, { status: 500 });
  }
}
