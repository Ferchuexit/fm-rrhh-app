import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEstadoImplementacion } from "@/lib/estado-implementacion-convenio";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const convenioId = searchParams.get("convenioId");

  try {
    if (convenioId) {
      return NextResponse.json(await obtenerEstadoImplementacion(convenioId));
    }
    // Sin convenioId: todos los convenios de una — para el panel general.
    const convenios = await prisma.convenio.findMany({ orderBy: { nombre: "asc" } });
    const estados = await Promise.all(convenios.map((c) => obtenerEstadoImplementacion(c.id)));
    return NextResponse.json(estados);
  } catch (e: any) {
    console.error("Error en GET /api/estado-implementacion:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo calcular el estado de implementación." }, { status: 500 });
  }
}
