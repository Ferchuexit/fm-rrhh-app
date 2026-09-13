// FM RRHH — app/api/docente-cargos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

export async function GET() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const cargos = await prisma.docCargo.findMany({ where: { activo: true }, orderBy: [{ nombre: "asc" }, { modalidad: "asc" }] });
  return NextResponse.json(cargos);
}
