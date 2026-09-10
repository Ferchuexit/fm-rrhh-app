// FM RRHH — app/api/fichadas/terminal/route.ts
//
// Ruta PÚBLICA (ver middleware.ts) — la terminal no tiene sesión de
// usuario, se identifica con su dispositivoId (ver nota de diseño en el
// schema). Fase 1: todavía no hay reconocimiento facial/huella (eso es
// Fase 3) — este endpoint recibe legajoId directo, como si el empleado
// hubiera tocado su nombre en una lista en la pantalla de la terminal.
// Cuando llegue la biometría, lo único que cambia es CÓMO la terminal
// consigue el legajoId antes de llamar acá — este endpoint no cambia.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ahoraArgentina } from "@/lib/fecha-argentina";

export async function POST(req: Request) {
  try {
    const { dispositivoId, legajoId, tipo, nivelConfianza } = await req.json();
    if (!dispositivoId || !legajoId) {
      return NextResponse.json({ error: "Faltan dispositivoId y legajoId." }, { status: 400 });
    }

    const dispositivo = await prisma.dispositivoAsistencia.findUnique({ where: { id: dispositivoId } });
    if (!dispositivo || !dispositivo.vinculado || !dispositivo.activo) {
      return NextResponse.json({ error: "Dispositivo no reconocido o inactivo." }, { status: 404 });
    }

    const legajo = await prisma.legajo.findFirst({ where: { id: legajoId, empresaId: dispositivo.empresaId } });
    if (!legajo) return NextResponse.json({ error: "Legajo no encontrado en la empresa de este dispositivo." }, { status: 404 });

    const { fecha, hora } = ahoraArgentina();

    const fichada = await prisma.fichada.create({
      data: {
        legajoId,
        fecha,
        hora,
        origen: "terminal",
        dispositivoId,
        tipo: tipo === "entrada" || tipo === "salida" ? tipo : null,
        nivelConfianza: typeof nivelConfianza === "number" ? nivelConfianza : null,
        sincronizada: true, // llegó ahora mismo al servidor — si en Fase 2 la terminal manda fichadas guardadas offline, ese flujo va a mandar sincronizada:false primero y confirmar después
      },
    });

    await prisma.dispositivoAsistencia.update({ where: { id: dispositivoId }, data: { ultimaConexion: new Date(), ultimaSincronizacion: new Date() } });

    return NextResponse.json({
      ok: true,
      fichadaId: fichada.id,
      legajo: { numero: legajo.numeroLegajo, apellido: legajo.apellido, nombre: legajo.nombre },
      hora,
    });
  } catch (e: any) {
    console.error("Error en POST /api/fichadas/terminal:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al registrar la fichada." }, { status: 500 });
  }
}
