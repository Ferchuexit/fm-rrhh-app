// FM RRHH — app/api/rangos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rangos = await prisma.rangoNumeracion.findMany();
  return NextResponse.json(rangos);
}

// Crea o actualiza el rango de un tipo — upsert manual porque SQLite/Prisma
// necesita el @@unique explícito para upsert; acá alcanza con buscar y crear/actualizar.
export async function PUT(req: Request) {
  const { tipo, desde, hasta } = await req.json();
  const existente = await prisma.rangoNumeracion.findUnique({ where: { tipo } });
  const rango = existente
    ? await prisma.rangoNumeracion.update({ where: { tipo }, data: { desde, hasta } })
    : await prisma.rangoNumeracion.create({ data: { tipo, desde, hasta } });
  return NextResponse.json(rango);
}
