import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const periodos = await prisma.periodoAnteriorTrabajado.findMany({ where: { legajoId: params.id }, orderBy: { fechaDesde: "desc" } });
  return NextResponse.json(periodos);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { empleador, fechaDesde, fechaHasta, motivo } = await req.json();
    if (!empleador?.trim() || !fechaDesde) {
      return NextResponse.json({ error: "Faltan empleador o fecha desde." }, { status: 400 });
    }
    const periodo = await prisma.periodoAnteriorTrabajado.create({
      data: {
        legajoId: params.id,
        empleador: empleador.trim(),
        fechaDesde: new Date(fechaDesde),
        fechaHasta: fechaHasta ? new Date(fechaHasta) : null,
        motivo: motivo?.trim() || null,
      },
    });
    return NextResponse.json(periodo);
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/periodos-anteriores:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
