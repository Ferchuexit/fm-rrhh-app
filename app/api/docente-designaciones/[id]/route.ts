// FM RRHH — app/api/docente-designaciones/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    // No se borra — queda el historial de que ese cargo existió, con
    // cuándo se dio de baja.
    await prisma.docDesignacion.update({
      where: { id: params.id },
      data: { activa: false, fechaBaja: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/docente-designaciones/[id]:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
