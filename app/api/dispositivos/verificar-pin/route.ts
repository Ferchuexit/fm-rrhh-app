// FM RRHH — app/api/dispositivos/verificar-pin/route.ts
// Ruta PÚBLICA (ver middleware.ts) — misma razón que /vincular. Destraba
// "modo administración" en la terminal (nuevo empleado, listado,
// configuración) sin necesitar el login real de un admin.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { dispositivoId, pin } = await req.json();
    if (!dispositivoId || !pin) return NextResponse.json({ error: "Falta el PIN." }, { status: 400 });

    const dispositivo = await prisma.dispositivoAsistencia.findUnique({ where: { id: dispositivoId } });
    if (!dispositivo) return NextResponse.json({ error: "Dispositivo no reconocido." }, { status: 404 });
    if (!dispositivo.pinHash) return NextResponse.json({ error: "Esta terminal todavía no tiene un PIN configurado — hacelo desde /dispositivos." }, { status: 409 });

    const correcto = await verificarPassword(pin, dispositivo.pinHash);
    if (!correcto) return NextResponse.json({ error: "PIN incorrecto." }, { status: 401 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos/verificar-pin:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
