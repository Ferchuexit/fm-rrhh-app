// FM RRHH — app/api/periodos-asistencia/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { obtenerSesionActual } from "@/lib/auth";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json([]);
  const periodos = await prisma.periodoAsistencia.findMany({
    where: { empresaId: empresa.id },
    orderBy: { fechaDesde: "desc" },
  });
  return NextResponse.json(periodos);
}

// Crea y cierra en un solo paso — "aceptar el calendario" y "cerrarlo" son
// la misma acción acá, no hay un estado intermedio "abierto" que se use
// hoy. Rechaza si el rango pedido se solapa con uno ya cerrado, para no
// tener dos cierres pisándose el mismo día.
export async function POST(req: Request) {
  try {
    const { nombre, fechaDesde, fechaHasta } = await req.json();
    if (!nombre?.trim() || !fechaDesde || !fechaHasta) {
      return NextResponse.json({ error: "Faltan nombre, fechaDesde o fechaHasta." }, { status: 400 });
    }
    const desde = new Date(fechaDesde);
    const hasta = new Date(fechaHasta);
    if (hasta < desde) {
      return NextResponse.json({ error: "La fecha hasta no puede ser anterior a la fecha desde." }, { status: 400 });
    }

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

    const solapado = await prisma.periodoAsistencia.findFirst({
      where: {
        empresaId: empresa.id,
        fechaDesde: { lte: hasta },
        fechaHasta: { gte: desde },
      },
    });
    if (solapado) {
      return NextResponse.json(
        { error: `Ya existe un período cerrado ("${solapado.nombre}") que se solapa con este rango. No se puede cerrar dos veces el mismo día.` },
        { status: 409 }
      );
    }

    const sesion = await obtenerSesionActual();

    const periodo = await prisma.periodoAsistencia.create({
      data: {
        empresaId: empresa.id,
        nombre: nombre.trim(),
        fechaDesde: desde,
        fechaHasta: hasta,
        estado: "cerrado",
        cerradoPor: sesion?.nombre ?? null,
      },
    });

    return NextResponse.json(periodo);
  } catch (e: any) {
    console.error("Error en POST /api/periodos-asistencia:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo cerrar el período." }, { status: 500 });
  }
}
