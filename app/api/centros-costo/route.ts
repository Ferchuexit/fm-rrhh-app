import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

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
