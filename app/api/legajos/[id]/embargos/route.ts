import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TIPOS_VALIDOS = ["judicial", "comercial"];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const embargos = await prisma.embargo.findMany({
    where: { legajoId: params.id },
    include: {
      cuotas: { orderBy: [{ anio: "asc" }, { mes: "asc" }] },
      documento: { select: { id: true, nombre: true } },
    },
    orderBy: { fechaInicio: "desc" },
  });
  return NextResponse.json(embargos);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tipo, descripcion, fechaInicio, porcentaje, montoTotal, documentoId } = await req.json();

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: `Tipo inválido. Tiene que ser "judicial" o "comercial".` }, { status: 400 });
    }
    if (!descripcion?.trim() || !fechaInicio) {
      return NextResponse.json({ error: "Falta la descripción o la fecha de inicio." }, { status: 400 });
    }
    if (tipo === "judicial" && (porcentaje === undefined || porcentaje === null || porcentaje === "")) {
      return NextResponse.json({ error: "El embargo judicial necesita el porcentaje dictado por el juez." }, { status: 400 });
    }
    if (tipo === "comercial" && (montoTotal === undefined || montoTotal === null || montoTotal === "")) {
      return NextResponse.json({ error: "El embargo comercial necesita el monto total de la deuda." }, { status: 400 });
    }

    const embargo = await prisma.embargo.create({
      data: {
        legajoId: params.id,
        tipo,
        descripcion: descripcion.trim(),
        fechaInicio: new Date(fechaInicio),
        activo: true,
        porcentaje: tipo === "judicial" ? Number(porcentaje) : null,
        montoTotal: tipo === "comercial" ? Number(montoTotal) : null,
        documentoId: documentoId || null,
      },
    });
    return NextResponse.json(embargo);
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/embargos:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo crear el embargo." }, { status: 500 });
  }
}
