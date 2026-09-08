// FM RRHH — app/api/liquidar/estado/route.ts
// Devuelve, para cada legajo que cumpla el filtro, si ya tiene una
// Liquidacion guardada para este período (con bruto/neto) o si todavía
// está pendiente. No liquida nada — es solo lectura, para la tabla de
// estado de /liquidar.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whereDeFiltro, type FiltroLegajos } from "@/lib/liquidar-filtro";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

  const filtro: FiltroLegajos = {
    modo: (searchParams.get("modo") as FiltroLegajos["modo"]) ?? "todos",
    convenioId: searchParams.get("convenioId") ?? undefined,
    legajoDesde: searchParams.get("legajoDesde") ? Number(searchParams.get("legajoDesde")) : undefined,
    legajoHasta: searchParams.get("legajoHasta") ? Number(searchParams.get("legajoHasta")) : undefined,
  };

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  const where = whereDeFiltro(periodo.empresaId, filtro, periodo.convenioId);

  const legajos = await prisma.legajo.findMany({
    where,
    include: {
      convenio: true,
      liquidaciones: { where: { periodoId } }, // como mucho una, por el @@unique([periodoId, legajoId])
    },
    orderBy: { numeroLegajo: "asc" },
  });

  const filas = legajos.map((l) => {
    const liq = l.liquidaciones[0];
    return {
      legajoId: l.id,
      numeroLegajo: l.numeroLegajo,
      apellido: l.apellido,
      nombre: l.nombre,
      convenio: l.convenio.codigo,
      estado: liq ? "liquidado" : "pendiente",
      bruto: liq?.bruto ?? null,
      neto: liq?.neto ?? null,
    };
  });

  return NextResponse.json({
    total: filas.length,
    liquidados: filas.filter((f) => f.estado === "liquidado").length,
    pendientes: filas.filter((f) => f.estado === "pendiente").length,
    filas,
  });
}
