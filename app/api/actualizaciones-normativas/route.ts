import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actualizaciones = await prisma.actualizacionNormativa.findMany({ orderBy: { fecha: "desc" } });
  return NextResponse.json(actualizaciones);
}

export async function POST(req: Request) {
  try {
    const { norma, fecha, vigenciaDesde, fuente, queModifica, convenios } = await req.json();
    if (!norma?.trim() || !fecha || !queModifica?.trim()) {
      return NextResponse.json({ error: "Faltan datos (norma, fecha, o qué modifica)." }, { status: 400 });
    }
    const actualizacion = await prisma.actualizacionNormativa.create({
      data: {
        norma: norma.trim(),
        fecha: new Date(fecha),
        vigenciaDesde: vigenciaDesde ? new Date(vigenciaDesde) : null,
        fuente: fuente?.trim() || null,
        queModifica: queModifica.trim(),
        convenios: convenios?.trim() || null,
      },
    });
    return NextResponse.json(actualizacion);
  } catch (e: any) {
    console.error("Error en POST /api/actualizaciones-normativas:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo registrar." }, { status: 500 });
  }
}
