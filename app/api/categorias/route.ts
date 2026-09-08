import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const convenioId = searchParams.get("convenioId");
  const categorias = await prisma.categoria.findMany({
    where: convenioId ? { convenioId } : undefined,
    orderBy: [{ convenio: { codigo: "asc" } }, { nombre: "asc" }],
    include: { convenio: true, _count: { select: { legajos: true, escalas: true } } },
  });
  return NextResponse.json(categorias);
}

export async function POST(req: Request) {
  try {
    // Mismo criterio que /api/convenios: el GET queda abierto (lo usa el
    // alta de legajos), pero crear una categoría nueva es acción de admin.
    const sesion = await obtenerSesionActual();
    if (sesion?.rol !== "admin") {
      return NextResponse.json({ error: "Solo un administrador puede crear categorías." }, { status: 403 });
    }

    const { convenioId, codigo, nombre } = await req.json();
    if (!convenioId || !nombre?.trim()) {
      return NextResponse.json({ error: "Faltan el convenio o el nombre." }, { status: 400 });
    }
    const categoria = await prisma.categoria.create({
      data: { convenioId, codigo: codigo?.trim() || nombre.trim().slice(0, 20), nombre: nombre.trim() },
    });
    return NextResponse.json(categoria);
  } catch (e: any) {
    console.error("Error en POST /api/categorias:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al crear la categoría." }, { status: 500 });
  }
}
