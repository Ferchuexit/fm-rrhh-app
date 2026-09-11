// FM RRHH — app/api/dispositivos/biometria/enrolar/route.ts
// Ruta PÚBLICA (ver middleware.ts) — la terminal no tiene sesión de
// usuario. Se protege con el PIN de "modo administración" en vez del
// login real de un admin (decisión del 10/09/2026, ver el chat).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { dispositivoId, pin, legajoId, descriptor } = await req.json();
    if (!dispositivoId || !pin || !legajoId || !Array.isArray(descriptor)) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    const dispositivo = await prisma.dispositivoAsistencia.findUnique({ where: { id: dispositivoId } });
    if (!dispositivo || !dispositivo.pinHash) return NextResponse.json({ error: "Terminal no reconocida o sin PIN configurado." }, { status: 404 });
    if (!(await verificarPassword(pin, dispositivo.pinHash))) return NextResponse.json({ error: "PIN incorrecto." }, { status: 401 });

    const legajo = await prisma.legajo.findFirst({ where: { id: legajoId, empresaId: dispositivo.empresaId } });
    if (!legajo) return NextResponse.json({ error: "Legajo no encontrado en esta empresa." }, { status: 404 });

    const existente = await prisma.biometriaEmpleado.findUnique({ where: { legajoId } });
    const biometria = existente
      ? await prisma.biometriaEmpleado.update({
          where: { legajoId },
          data: { descriptor: JSON.stringify(descriptor), estado: "activo", dispositivoAltaId: dispositivoId, fechaAlta: new Date(), fechaRevocacion: null },
        })
      : await prisma.biometriaEmpleado.create({
          data: { legajoId, descriptor: JSON.stringify(descriptor), dispositivoAltaId: dispositivoId },
        });

    return NextResponse.json({ ok: true, id: biometria.id, legajo: { numero: legajo.numeroLegajo, apellido: legajo.apellido, nombre: legajo.nombre } });
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos/biometria/enrolar:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al registrar." }, { status: 500 });
  }
}
