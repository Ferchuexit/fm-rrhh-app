// FM RRHH — app/api/legajos/[id]/docente-perfil/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });

  const legajo = await prisma.legajo.findFirst({ where: { id: params.id, empresaId: empresa.id } });
  if (!legajo) return NextResponse.json({ error: "Legajo no encontrado en esta empresa." }, { status: 404 });

  const perfil = await prisma.docPerfilDocente.findUnique({
    where: { legajoId: params.id },
    include: {
      designaciones: {
        where: { activa: true },
        include: { docCargo: true },
        orderBy: { fechaAlta: "asc" },
      },
    },
  });
  return NextResponse.json(perfil);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });

    const legajo = await prisma.legajo.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!legajo) return NextResponse.json({ error: "Legajo no encontrado en esta empresa." }, { status: 404 });

    const { antiguedadAnios, antiguedadDesde } = await req.json();
    if (typeof antiguedadAnios !== "number" || antiguedadAnios < 0) {
      return NextResponse.json({ error: "La antigüedad tiene que ser un número mayor o igual a 0." }, { status: 400 });
    }

    const perfil = await prisma.docPerfilDocente.upsert({
      where: { legajoId: params.id },
      update: { antiguedadAnios, antiguedadDesde: antiguedadDesde ? new Date(antiguedadDesde) : null },
      create: { legajoId: params.id, antiguedadAnios, antiguedadDesde: antiguedadDesde ? new Date(antiguedadDesde) : null },
    });
    return NextResponse.json(perfil);
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/docente-perfil:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
