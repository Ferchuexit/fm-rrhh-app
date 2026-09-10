// FM RRHH — app/api/dispositivos/heartbeat/route.ts
// Ruta PÚBLICA (ver middleware.ts) — misma razón que /vincular. La
// terminal llama esto cada un par de minutos mientras está prendida.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { dispositivoId, version } = await req.json();
    if (!dispositivoId) return NextResponse.json({ error: "Falta dispositivoId." }, { status: 400 });

    const dispositivo = await prisma.dispositivoAsistencia.findUnique({ where: { id: dispositivoId } });
    if (!dispositivo || !dispositivo.vinculado) return NextResponse.json({ error: "Dispositivo no reconocido." }, { status: 404 });

    await prisma.dispositivoAsistencia.update({
      where: { id: dispositivoId },
      data: { ultimaConexion: new Date(), ...(version ? { version } : {}) },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos/heartbeat:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
