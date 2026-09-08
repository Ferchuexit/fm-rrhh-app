// FM RRHH — app/api/periodos-asistencia/[id]/route.ts
// Reabre un período cerrado. No lo borra — cambia el estado a 'reabierto'
// (que ya no bloquea nada, ver lib/periodo-asistencia-lock.ts) y deja
// constancia de quién lo reabrió, cuándo, y por qué — mismo criterio que
// Salvedad para el cierre de liquidación: la excepción se documenta, no
// se borra el rastro de que hubo un cierre.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { motivo } = await req.json();
    if (!motivo?.trim()) {
      return NextResponse.json({ error: "Hace falta un motivo para reabrir un período cerrado." }, { status: 400 });
    }

    const periodo = await prisma.periodoAsistencia.findUnique({ where: { id: params.id } });
    if (!periodo) return NextResponse.json({ error: "No se encontró ese período." }, { status: 404 });
    if (periodo.estado !== "cerrado") {
      return NextResponse.json({ error: `Este período ya está "${periodo.estado}", no hay nada que reabrir.` }, { status: 409 });
    }

    const sesion = await obtenerSesionActual();

    const actualizado = await prisma.periodoAsistencia.update({
      where: { id: params.id },
      data: {
        estado: "reabierto",
        fechaReapertura: new Date(),
        reabiertoPor: sesion?.nombre ?? null,
        motivoReapertura: motivo.trim(),
      },
    });

    return NextResponse.json(actualizado);
  } catch (e: any) {
    console.error("Error en PATCH /api/periodos-asistencia/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo reabrir el período." }, { status: 500 });
  }
}
