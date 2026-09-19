// FM RRHH — app/api/fichadas/[id]/route.ts
// Corrección manual — requiere sesión (viene de una pantalla del sistema,
// no de la terminal). El dato original (fecha/hora) nunca se toca.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const { horaCorregida, motivoCorreccion } = await req.json();
    if (!horaCorregida?.trim() || !motivoCorreccion?.trim()) {
      return NextResponse.json({ error: "Faltan la hora corregida y el motivo." }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(horaCorregida.trim())) {
      return NextResponse.json({ error: "La hora tiene que tener formato HH:mm o HH:mm:ss." }, { status: 400 });
    }

    const fichada = await prisma.fichada.update({
      where: { id: params.id },
      data: {
        horaCorregida: horaCorregida.trim(),
        motivoCorreccion: motivoCorreccion.trim(),
        corregidoPorId: sesion.id,
        fechaCorreccion: new Date(),
      },
    });
    return NextResponse.json(fichada);
  } catch (e: any) {
    console.error("Error en PATCH /api/fichadas/[id]:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al corregir la fichada." }, { status: 500 });
  }
}

// Eliminar una fichada — en realidad la marca "anulada" con motivo, quién
// y cuándo. Nunca se borra de la base (mismo criterio que el resto del
// sistema con registros que importan para auditoría): queda afuera de los
// listados normales, pero el dato sigue existiendo si hace falta revisarlo.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const { motivoAnulacion } = await req.json();
    if (!motivoAnulacion?.trim()) {
      return NextResponse.json({ error: "Hace falta indicar el motivo de la anulación." }, { status: 400 });
    }

    const fichada = await prisma.fichada.update({
      where: { id: params.id },
      data: {
        anulada: true,
        motivoAnulacion: motivoAnulacion.trim(),
        anuladoPorId: sesion.id,
        fechaAnulacion: new Date(),
      },
    });
    return NextResponse.json(fichada);
  } catch (e: any) {
    console.error("Error en DELETE /api/fichadas/[id]:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al anular la fichada." }, { status: 500 });
  }
}
