// FM RRHH — app/api/novedades/route.ts
// DELETE masivo — Novedad no tiene periodoId (guarda una fecha suelta,
// "periodo", matcheada por rango contra Periodo.fechaDesde/fechaHasta,
// igual que ya hace /api/liquidar) — así que el filtro por período acá
// es "la fecha cae dentro del rango del período elegido", no una FK
// directa. Reutiliza el mismo filtro de legajos (todos/convenio/rango)
// que ya usan /liquidar y /recibos, más un filtro opcional por concepto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whereDeFiltro, type FiltroLegajos } from "@/lib/liquidar-filtro";

// Consulta las novedades YA CARGADAS para un período — no existía ninguna
// forma de ver esto antes (solo cargar y borrar a ciegas). Mismo criterio
// de matcheo por rango de fecha que ya usa el DELETE de acá abajo.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get("periodoId");
    if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });

    const novedades = await prisma.novedad.findMany({
      where: {
        legajo: { empresaId: periodo.empresaId },
        periodo: { gte: periodo.fechaDesde, lte: periodo.fechaHasta },
      },
      include: { legajo: { select: { numeroLegajo: true, apellido: true, nombre: true } }, concepto: { select: { codigo: true, nombre: true } } },
      orderBy: [{ legajo: { numeroLegajo: "asc" } }, { periodo: "asc" }],
    });

    return NextResponse.json(
      novedades.map((n) => ({
        id: n.id,
        legajoNumero: n.legajo.numeroLegajo,
        legajoNombre: `${n.legajo.apellido}, ${n.legajo.nombre}`,
        fecha: n.periodo.toISOString().substring(0, 10),
        conceptoCodigo: n.concepto.codigo,
        conceptoNombre: n.concepto.nombre,
        cantidad: n.cantidad,
        valor: n.valor,
        estado: n.estado,
      }))
    );
  } catch (e: any) {
    console.error("Error en GET /api/novedades:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al consultar novedades." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { periodoId, filtro, conceptoCodigo } = await req.json();
    if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
    const whereLegajos = whereDeFiltro(periodo.empresaId, (filtro as FiltroLegajos) ?? { modo: "todos" }, periodo.convenioId);
    const legajos = await prisma.legajo.findMany({ where: whereLegajos, select: { id: true } });
    const legajoIds = legajos.map((l) => l.id);

    const where: any = {
      legajoId: { in: legajoIds },
      periodo: { gte: periodo.fechaDesde, lte: periodo.fechaHasta },
    };
    if (conceptoCodigo) where.concepto = { codigo: conceptoCodigo };

    const resultado = await prisma.novedad.deleteMany({ where });
    return NextResponse.json({ eliminadas: resultado.count });
  } catch (e: any) {
    console.error("Error en DELETE /api/novedades:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al eliminar novedades." }, { status: 500 });
  }
}
