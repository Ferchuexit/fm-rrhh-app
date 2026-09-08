import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const categoriaId = searchParams.get("categoriaId");
  if (!categoriaId) return NextResponse.json({ error: "Falta categoriaId" }, { status: 400 });

  const escalas = await prisma.escala.findMany({ where: { categoriaId }, orderBy: { vigenciaDesde: "desc" } });
  return NextResponse.json(escalas);
}

export async function POST(req: Request) {
  try {
    // Actualizar la escala salarial es una acción de administración — mismo
    // criterio que /api/convenios y /api/categorias.
    const sesion = await obtenerSesionActual();
    if (sesion?.rol !== "admin") {
      return NextResponse.json({ error: "Solo un administrador puede actualizar escalas." }, { status: 403 });
    }

    const { categoriaId, vigenciaDesde, basico, valorHora } = await req.json();
    if (!categoriaId || !vigenciaDesde) {
      return NextResponse.json({ error: "Faltan categoriaId o vigenciaDesde." }, { status: 400 });
    }

    const categoria = await prisma.categoria.findUniqueOrThrow({ where: { id: categoriaId } });

    // Fecha sin componente de hora — evita el mismo bug de zona horaria que
    // ya pasó una vez con las escalas importadas (ver 39-fix-zona-horaria.md).
    const fecha = new Date(String(vigenciaDesde).slice(0, 10));

    const yaExiste = await prisma.escala.findFirst({ where: { categoriaId, vigenciaDesde: fecha } });
    if (yaExiste) {
      return NextResponse.json({ error: "Ya existe una escala para esta categoría con esa fecha de vigencia exacta." }, { status: 409 });
    }

    const escala = await prisma.escala.create({
      data: { convenioId: categoria.convenioId, categoriaId, vigenciaDesde: fecha, basico: Number(basico) || 0, valorHora: Number(valorHora) || 0 },
    });
    return NextResponse.json(escala);
  } catch (e: any) {
    console.error("Error en POST /api/escalas:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al crear la escala." }, { status: 500 });
  }
}
