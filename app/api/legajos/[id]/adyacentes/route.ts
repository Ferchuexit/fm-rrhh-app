// FM RRHH — app/api/legajos/[id]/adyacentes/route.ts
// Para el botón de "anterior/siguiente" del formulario de edición — el
// orden es por número de legajo, dentro de la misma empresa.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const actual = await prisma.legajo.findUniqueOrThrow({ where: { id: params.id } });

  const anterior = await prisma.legajo.findFirst({
    where: { empresaId: actual.empresaId, numeroLegajo: { lt: actual.numeroLegajo } },
    orderBy: { numeroLegajo: "desc" },
    select: { id: true, numeroLegajo: true, apellido: true },
  });
  const siguiente = await prisma.legajo.findFirst({
    where: { empresaId: actual.empresaId, numeroLegajo: { gt: actual.numeroLegajo } },
    orderBy: { numeroLegajo: "asc" },
    select: { id: true, numeroLegajo: true, apellido: true },
  });

  return NextResponse.json({ anterior, siguiente });
}
