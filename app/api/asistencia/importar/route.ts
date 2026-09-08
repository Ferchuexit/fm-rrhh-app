// FM RRHH — app/api/asistencia/importar/route.ts
// Recibe filas YA NORMALIZADAS por el cliente (app/asistencia/page.tsx hace
// el parseo del Excel con la librería xlsx, igual que /novedades) — acá
// solo queda matchear legajo, chequear cierre, y guardar. La validación
// estricta de fecha (rechazar "1/7/2026" ambiguo) vive del lado del
// cliente para que el error se vea al toque, sin ida y vuelta al server.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { obtenerPeriodosCerrados, fechaEstaCerrada } from "@/lib/periodo-asistencia-lock";

export async function POST(req: Request) {
  try {
    const { filas } = await req.json();
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: "No hay filas para importar." }, { status: 400 });
    }

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

    const legajos = await prisma.legajo.findMany({ where: { empresaId: empresa.id }, select: { id: true, numeroLegajo: true } });
    const legajoPorNumero = new Map(legajos.map((l) => [l.numeroLegajo, l.id]));
    const periodosCerrados = await obtenerPeriodosCerrados(empresa.id);

    let creadas = 0, saltadas = 0, sinLegajo = 0, enPeriodoCerrado = 0;
    const legajosNoEncontrados = new Set<number>();
    let fechaMin: string | null = null, fechaMax: string | null = null;

    for (const fila of filas) {
      const numeroLegajo = Number(fila.numeroLegajo);
      const fechaStr = fila.fecha as string; // "YYYY-MM-DD", ya validada por el cliente
      const hora = fila.hora as string; // "HH:mm:ss"
      if (!numeroLegajo || !fechaStr || !hora) continue;

      if (!fechaMin || fechaStr < fechaMin) fechaMin = fechaStr;
      if (!fechaMax || fechaStr > fechaMax) fechaMax = fechaStr;

      const fecha = new Date(fechaStr + "T00:00:00.000Z");

      if (fechaEstaCerrada(fecha, periodosCerrados)) { enPeriodoCerrado++; continue; }

      const legajoId = legajoPorNumero.get(numeroLegajo);
      if (!legajoId) { legajosNoEncontrados.add(numeroLegajo); sinLegajo++; continue; }

      const yaExiste = await prisma.fichada.findFirst({ where: { legajoId, fecha, hora } });
      if (yaExiste) { saltadas++; continue; }

      await prisma.fichada.create({ data: { legajoId, fecha, hora, origen: "reloj" } });
      creadas++;
    }

    return NextResponse.json({
      creadas,
      saltadas,
      sinLegajo,
      enPeriodoCerrado,
      legajosNoEncontrados: [...legajosNoEncontrados].sort((a, b) => a - b),
      fechaMin,
      fechaMax,
    });
  } catch (e: any) {
    console.error("Error en POST /api/asistencia/importar:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo importar." }, { status: 500 });
  }
}
