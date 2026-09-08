import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";


// Sin esto, Next.js puede intentar generar esta ruta como página ESTÁTICA en
// el momento del build (congelada con lo que hubiera en la base ese día) en
// vez de ejecutarla fresca en cada visita — encontrado el 09/09/2026 al
// preparar el primer deploy a Vercel (/api/rangos rompía el build por esto).
export const dynamic = "force-dynamic";

export async function GET() {
  const convenios = await prisma.convenio.findMany({
    orderBy: { codigo: "asc" },
    include: { _count: { select: { categorias: true, legajos: true } } },
  });
  return NextResponse.json(convenios);
}

export async function POST(req: Request) {
  try {
    // El GET queda abierto a cualquier usuario logueado (lo usan /liquidar
    // y el alta de legajos, que no son pantallas solo-admin) — pero crear
    // un convenio nuevo sí es una acción de administración.
    const sesion = await obtenerSesionActual();
    if (sesion?.rol !== "admin") {
      return NextResponse.json({ error: "Solo un administrador puede crear convenios." }, { status: 403 });
    }

    const { codigo, nombre } = await req.json();
    if (!codigo?.trim() || !nombre?.trim()) {
      return NextResponse.json({ error: "Faltan código o nombre." }, { status: 400 });
    }
    const convenio = await prisma.convenio.create({ data: { codigo: codigo.trim(), nombre: nombre.trim() } });
    return NextResponse.json(convenio);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un convenio con ese código." }, { status: 409 });
    }
    console.error("Error en POST /api/convenios:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al crear el convenio." }, { status: 500 });
  }
}
