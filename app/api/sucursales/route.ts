import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json([]);
  const sucursales = await prisma.sucursal.findMany({ where: { empresaId: empresa.id }, orderBy: { nombre: "asc" } });
  return NextResponse.json(sucursales);
}

export async function POST(req: Request) {
  const { nombre, direccion } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });
  const sucursal = await prisma.sucursal.create({ data: { empresaId: empresa.id, nombre: nombre.trim(), direccion: direccion?.trim() || null } });
  return NextResponse.json(sucursal);
}
