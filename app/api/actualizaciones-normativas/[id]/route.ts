import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

const ESTADOS_VALIDOS = ["pendiente", "validada", "aplicada"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { estadoValidacion } = await req.json();
    if (!ESTADOS_VALIDOS.includes(estadoValidacion)) {
      return NextResponse.json({ error: `Estado inválido. Tiene que ser uno de: ${ESTADOS_VALIDOS.join(", ")}.` }, { status: 400 });
    }

    const sesion = await obtenerSesionActual();
    const data: any = { estadoValidacion };
    if (estadoValidacion === "aplicada") {
      data.aplicadaPor = sesion?.email ?? null;
      data.fechaAplicacion = new Date();
    }

    const actualizacion = await prisma.actualizacionNormativa.update({ where: { id: params.id }, data });
    return NextResponse.json(actualizacion);
  } catch (e: any) {
    console.error("Error en PATCH /api/actualizaciones-normativas/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo actualizar." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.actualizacionNormativa.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/actualizaciones-normativas/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo borrar." }, { status: 500 });
  }
}
