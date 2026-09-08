import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TIPOS_VALIDOS = ["conyuge", "hijo", "hijo_incapacitado"];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const cargas = await prisma.cargaFamiliarGanancias.findMany({
    where: { legajoId: params.id },
    orderBy: [{ tipo: "asc" }, { vigenciaDesde: "asc" }],
  });
  return NextResponse.json(cargas);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tipo, descripcion, vigenciaDesde } = await req.json();
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: `Tipo inválido. Tiene que ser uno de: ${TIPOS_VALIDOS.join(", ")}.` }, { status: 400 });
    }
    if (!vigenciaDesde) {
      return NextResponse.json({ error: "Falta la fecha desde cuándo es carga de familia." }, { status: 400 });
    }
    const carga = await prisma.cargaFamiliarGanancias.create({
      data: { legajoId: params.id, tipo, descripcion: descripcion?.trim() || null, vigenciaDesde: new Date(vigenciaDesde) },
    });
    return NextResponse.json(carga);
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/cargas-familia:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo agregar la carga de familia." }, { status: 500 });
  }
}
