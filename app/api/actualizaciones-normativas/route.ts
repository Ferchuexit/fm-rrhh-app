import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// Sin esto, Next.js puede intentar generar esta ruta como página ESTÁTICA en
// el momento del build (congelada con lo que hubiera en la base ese día) en
// vez de ejecutarla fresca en cada visita — encontrado el 09/09/2026 al
// preparar el primer deploy a Vercel (/api/rangos rompía el build por esto).
export const dynamic = "force-dynamic";

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
