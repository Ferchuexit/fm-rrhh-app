import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anio = Number(searchParams.get("anio")) || new Date().getFullYear();
  const centroCostoId = searchParams.get("centroCostoId");

  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ legajos: [] });

  const legajos = await prisma.legajo.findMany({
    where: { empresaId: empresa.id, condicion: "activo", ...(centroCostoId ? { centroCostoId } : {}) },
    include: {
      centroCosto: true,
      vacaciones: { where: { fechaDesde: { gte: new Date(anio, 0, 1) }, fechaHasta: { lte: new Date(anio, 11, 31) } } },
    },
    orderBy: { numeroLegajo: "asc" },
  });

  return NextResponse.json({
    anio,
    legajos: legajos.map((l) => ({
      id: l.id,
      numero: l.numeroLegajo,
      apellido: l.apellido,
      nombre: l.nombre,
      centroCosto: l.centroCosto?.nombre ?? "Sin asignar",
      vacaciones: l.vacaciones.map((v) => ({ fechaDesde: v.fechaDesde, fechaHasta: v.fechaHasta, dias: v.diasCorresponden })),
    })),
  });
}
