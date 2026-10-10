import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anio = Number(searchParams.get("anio")) || new Date().getFullYear();
  const centroCostoId = searchParams.get("centroCostoId");

  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ legajos: [] });

  const inicioAnio = new Date(Date.UTC(anio, 0, 1));
  const finAnio = new Date(Date.UTC(anio, 11, 31));
  const legajos = await prisma.legajo.findMany({
    where: { empresaId: empresa.id, condicion: "activo", ...(centroCostoId ? { centroCostoId } : {}) },
    include: {
      centroCosto: true,
      // Todo lo que TOCA el año (antes se perdían las vacaciones que cruzan
      // de diciembre a enero: no aparecían en ninguno de los dos años).
      vacaciones: { where: { fechaDesde: { lte: finAnio }, fechaHasta: { gte: inicioAnio } } },
      // Pedidos de vacaciones sin responder: se dibujan rayados, para ver
      // cómo quedaría el año si se aprueban.
      solicitudesAusencia: { where: { tipo: "vacaciones", estado: "pendiente", fechaDesde: { lte: finAnio }, fechaHasta: { gte: inicioAnio } } },
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
      pendientes: l.solicitudesAusencia.map((p) => ({ fechaDesde: p.fechaDesde, fechaHasta: p.fechaHasta, dias: p.dias })),
    })),
  });
}
