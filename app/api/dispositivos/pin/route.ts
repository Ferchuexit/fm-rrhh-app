// FM RRHH — app/api/dispositivos/pin/route.ts
// Admin-only. El PIN se guarda hasheado (igual que las contraseñas de
// usuario) — ni siquiera un dump de la base revela el PIN en texto plano.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { dispositivoId, pin } = await req.json();
    if (!dispositivoId || !pin) return NextResponse.json({ error: "Faltan dispositivoId y pin." }, { status: 400 });
    if (!/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: "El PIN tiene que tener entre 4 y 6 números." }, { status: 400 });

    const pinHash = await hashPassword(pin);
    await prisma.dispositivoAsistencia.update({ where: { id: dispositivoId }, data: { pinHash } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos/pin:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al configurar el PIN." }, { status: 500 });
  }
}
