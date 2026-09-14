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

    const { docCargoId, establecimiento, zonaDesfavorabilidad, fechaAlta, cantidadModulos } = await req.json();
    if (!docCargoId || !fechaAlta) return NextResponse.json({ error: "Faltan docCargoId y fechaAlta." }, { status: 400 });

    if (zonaDesfavorabilidad != null && (zonaDesfavorabilidad < 1 || zonaDesfavorabilidad > 5)) {
      return NextResponse.json({ error: "El nivel de zona desfavorable tiene que ser entre 1 y 5." }, { status: 400 });
    }

    const cargo = await prisma.docCargo.findUnique({ where: { id: docCargoId } });
    if (!cargo) return NextResponse.json({ error: "Cargo no encontrado en el nomenclador." }, { status: 404 });

    if (cargo.tipo === "hora_catedra" && (!cantidadModulos || cantidadModulos < 1)) {
      return NextResponse.json({ error: "Para un cargo por hora cátedra hace falta indicar la cantidad de horas." }, { status: 400 });
    }

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
        zonaDesfavorabilidad: zonaDesfavorabilidad != null ? Number(zonaDesfavorabilidad) : null,
        fechaAlta: new Date(fechaAlta),
        cantidadModulos: cargo.tipo === "hora_catedra" ? Number(cantidadModulos) : 1,
      },
      include: { docCargo: true },
    });
    return NextResponse.json(designacion);
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/docente-designaciones:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
