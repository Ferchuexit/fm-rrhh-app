// FM RRHH — app/api/legajos/[id]/docente-designaciones/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });

    const legajo = await prisma.legajo.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!legajo) return NextResponse.json({ error: "Legajo no encontrado en esta empresa." }, { status: 404 });

    const { docCargoId, establecimiento, zonaRural, fechaAlta } = await req.json();
    if (!docCargoId || !fechaAlta) return NextResponse.json({ error: "Faltan docCargoId y fechaAlta." }, { status: 400 });

    const cargo = await prisma.docCargo.findUnique({ where: { id: docCargoId } });
    if (!cargo) return NextResponse.json({ error: "Cargo no encontrado en el nomenclador." }, { status: 404 });

    // Si el legajo todavía no tiene perfil docente (antigüedad), se crea
    // con 0 años — se puede editar después desde la misma pantalla.
    const perfil = await prisma.docPerfilDocente.upsert({
      where: { legajoId: params.id },
      update: {},
      create: { legajoId: params.id, antiguedadAnios: 0 },
    });

    const designacion = await prisma.docDesignacion.create({
      data: {
        perfilDocenteId: perfil.id,
        docCargoId,
        establecimiento: establecimiento || null,
        zonaRural: !!zonaRural,
        fechaAlta: new Date(fechaAlta),
      },
      include: { docCargo: true },
    });
    return NextResponse.json(designacion);
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/docente-designaciones:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
