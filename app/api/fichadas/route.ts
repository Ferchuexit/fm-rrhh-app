// FM RRHH — app/api/fichadas/route.ts
// Requiere sesión normal (no es ruta pública) — para auditar fichadas hay
// que estar logueado, a diferencia de /api/fichadas/terminal.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const legajoId = searchParams.get("legajoId") ?? undefined;
  const dispositivoId = searchParams.get("dispositivoId") ?? undefined;
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const fichadas = await prisma.fichada.findMany({
    where: {
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
    },
    include: {
      legajo: { select: { numeroLegajo: true, apellido: true, nombre: true } },
      dispositivo: { select: { nombre: true, ubicacion: true } },
      corregidoPor: { select: { nombre: true } },
    },
    orderBy: [{ fecha: "desc" }, { hora: "desc" }],
    take: 500, // tope razonable — esto es para auditar, no para exportar todo el historial de una
  });

  return NextResponse.json(fichadas);
}
