import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

const ESTADOS_VALIDOS = ["aprobado", "aprobado_con_observaciones", "rechazado"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

  const aprobaciones = await prisma.aprobacionPeriodo.findMany({ where: { periodoId }, orderBy: { fecha: "desc" } });
  return NextResponse.json(aprobaciones);
}

export async function POST(req: Request) {
  try {
    const { periodoId, estado, observaciones } = await req.json();
    if (!periodoId || !ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: `Falta periodoId, o el estado no es válido (tiene que ser uno de: ${ESTADOS_VALIDOS.join(", ")}).` }, { status: 400 });
    }
    if ((estado === "aprobado_con_observaciones" || estado === "rechazado") && !observaciones?.trim()) {
      return NextResponse.json({ error: "Para aprobar con observaciones o rechazar, tenés que escribir el motivo." }, { status: 400 });
    }

    const sesion = await obtenerSesionActual();
    const aprobacion = await prisma.aprobacionPeriodo.create({
      data: { periodoId, estado, observaciones: observaciones?.trim() || null, usuario: sesion?.email ?? null },
    });
    return NextResponse.json(aprobacion);
  } catch (e: any) {
    console.error("Error en POST /api/aprobar:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo registrar la aprobación." }, { status: 500 });
  }
}
