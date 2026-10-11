// FM RRHH — app/api/reclutamiento/banco/route.ts
// La base de candidatos de la empresa: todos los que alguna vez se
// postularon, para volver a buscarlos cuando se abre algo parecido.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { CAMPOS_CANDIDATO } from "@/lib/reclutamiento";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
    const contiene = { contains: q, mode: "insensitive" as const };
    const candidatos = await prisma.candidato.findMany({
      where: { busqueda: { empresaId: empresa.id }, ...(q ? { OR: [{ apellido: contiene }, { nombre: contiene }, { localidad: contiene }, { notas: contiene }, { mensaje: contiene }, { busqueda: { titulo: contiene } }] } : {}) },
      select: { ...CAMPOS_CANDIDATO, busqueda: { select: { titulo: true, estado: true } } },
      orderBy: [{ puntaje: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 100,
    });
    return NextResponse.json({ candidatos });
  } catch (e) {
    console.error("Error en GET /api/reclutamiento/banco:", e);
    return NextResponse.json({ error: "No se pudo buscar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
