// FM RRHH — app/api/fichadas/route.ts
// Requiere sesión normal (no es ruta pública) — para auditar fichadas hay
// que estar logueado, a diferencia de /api/fichadas/terminal.
//
// FIX 10/09/2026 (encontrado por Fernando probando con la empresa de
// familia): faltaba filtrar por empresa — antes mostraba fichadas de
// TODAS las empresas mezcladas, no solo de la que tenías seleccionada.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

const COLUMNAS_ORDEN: Record<string, any> = {
  fecha: [{ fecha: "desc" }, { hora: "desc" }],
  legajo: [{ legajo: { numeroLegajo: "asc" } }, { fecha: "desc" }],
  apellido: [{ legajo: { apellido: "asc" } }, { fecha: "desc" }],
};

export async function GET(req: Request) {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const legajoId = searchParams.get("legajoId") ?? undefined;
  const dispositivoId = searchParams.get("dispositivoId") ?? undefined;
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const buscar = searchParams.get("buscar")?.trim();
  const orden = COLUMNAS_ORDEN[searchParams.get("orden") ?? "fecha"] ?? COLUMNAS_ORDEN.fecha;

  const numeroBuscado = buscar && /^\d+$/.test(buscar) ? Number(buscar) : undefined;

  const fichadas = await prisma.fichada.findMany({
    where: {
      legajo: { empresaId: empresa.id }, // ← el fix
      ...(legajoId ? { legajoId } : {}),
      ...(dispositivoId ? { dispositivoId } : {}),
      ...(desde || hasta
        ? {
            fecha: {
              ...(desde ? { gte: new Date(desde) } : {}),
              ...(hasta ? { lte: new Date(hasta) } : {}),
            },
          }
        : {}),
      ...(buscar
        ? {
            legajo: {
              empresaId: empresa.id,
              OR: [
                ...(numeroBuscado != null ? [{ numeroLegajo: numeroBuscado }] : []),
                { apellido: { contains: buscar, mode: "insensitive" as const } },
                { nombre: { contains: buscar, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    include: {
      legajo: { select: { numeroLegajo: true, apellido: true, nombre: true } },
      dispositivo: { select: { nombre: true, ubicacion: true } },
      corregidoPor: { select: { nombre: true } },
    },
    orderBy: orden,
    take: 500, // tope razonable — esto es para auditar, no para exportar todo el historial de una
  });

  return NextResponse.json(fichadas);
}
