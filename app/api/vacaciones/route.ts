// FM RRHH — app/api/vacaciones/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { diasVacacionesPorAntiguedad, calcularAntiguedadAnios } from "@/lib/vacaciones";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json([]);
  const vacaciones = await prisma.vacacion.findMany({
    where: { legajo: { empresaId: empresa.id } },
    include: { legajo: { include: { centroCosto: true } } },
    orderBy: { fechaDesde: "desc" },
  });
  return NextResponse.json(vacaciones);
}

export async function POST(req: Request) {
  try {
    const { legajoId, anioCorresponde, fechaDesde, fechaHasta, diasCorresponden } = await req.json();

    if (!legajoId || !fechaDesde || !fechaHasta) {
      return NextResponse.json({ error: "Faltan legajoId, fechaDesde o fechaHasta." }, { status: 400 });
    }
    if (new Date(fechaHasta) < new Date(fechaDesde)) {
      return NextResponse.json({ error: "La fecha hasta no puede ser anterior a la fecha desde." }, { status: 400 });
    }

    const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: legajoId } });

    // Si no se pasó diasCorresponden explícito, se calcula por antigüedad —
    // igual que hace la pantalla, pero recalculado acá también por las dudas
    // de que alguien llame a la API directo sin pasar por la UI. Number(...)
    // explícito porque lo que llega del formulario es un string (viene de un
    // <input>), y Prisma necesita un entero real para el campo Int — pasarle
    // el string tal cual tiraba un error que esta ruta no capturaba, y el
    // navegador recibía una respuesta vacía en vez de un JSON con el error.
    const dias = diasCorresponden
      ? Number(diasCorresponden)
      : diasVacacionesPorAntiguedad(calcularAntiguedadAnios(legajo.fechaIngreso, legajo.antiguedadReconocida, new Date(fechaDesde)));

    const vacacion = await prisma.vacacion.create({
      data: {
        legajoId,
        anioCorresponde: Number(anioCorresponde) || new Date(fechaDesde).getFullYear(),
        diasCorresponden: dias,
        fechaDesde: new Date(fechaDesde),
        fechaHasta: new Date(fechaHasta),
      },
    });

    return NextResponse.json(vacacion);
  } catch (e: any) {
    // Red de seguridad: cualquier error que no se haya previsto arriba
    // devuelve igual un JSON válido con el mensaje, en vez de que Next.js
    // devuelva una página de error HTML que el cliente no puede parsear.
    console.error("Error en POST /api/vacaciones:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al registrar las vacaciones." }, { status: 500 });
  }
}
