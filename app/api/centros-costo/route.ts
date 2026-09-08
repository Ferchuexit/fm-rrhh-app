import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";


// Sin esto, Next.js puede intentar generar esta ruta como página ESTÁTICA en
// el momento del build (congelada con lo que hubiera en la base ese día) en
// vez de ejecutarla fresca en cada visita — encontrado el 09/09/2026 al
// preparar el primer deploy a Vercel (/api/rangos rompía el build por esto).
export const dynamic = "force-dynamic";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json([]);
  const centros = await prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, orderBy: { nombre: "asc" } });
  return NextResponse.json(centros);
}

export async function POST(req: Request) {
  const { nombre } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });
  const centro = await prisma.centroCosto.create({ data: { empresaId: empresa.id, nombre: nombre.trim() } });
  return NextResponse.json(centro);
}
