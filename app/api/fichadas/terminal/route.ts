// FM RRHH — app/api/fichadas/terminal/route.ts
//
// Ruta PÚBLICA (ver middleware.ts) — la terminal no tiene sesión de
// usuario, se identifica con su dispositivoId (ver nota de diseño en el
// schema). Recibe legajoId directo — cómo la terminal consigue ese
// legajoId (cámara, huella, o una excepción manual con PIN) no le importa
// a este endpoint.
//
// CAMBIO 11/09/2026 (pedido de Fernando, para que sea más rápido en un
// ingreso masivo): el tipo (entrada/salida) YA NO lo elige el empleado —
// se determina solo, alternando según cuántas fichadas ya tiene ese
// legajo hoy. Par (0, 2, 4...) → entrada. Impar (1, 3...) → salida. Simple
// y suficiente para el caso normal; no depende de la hora del turno
// (eso es una mejora futura, cuando haya turnos cargados y se pueda
// comparar contra el horario esperado).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ahoraArgentina } from "@/lib/fecha-argentina";

export async function POST(req: Request) {
  try {
    const { dispositivoId, legajoId, nivelConfianza } = await req.json();
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

    const fichadasDeHoy = await prisma.fichada.count({ where: { legajoId, fecha } });
    const tipo: "entrada" | "salida" = fichadasDeHoy % 2 === 0 ? "entrada" : "salida";

    const fichada = await prisma.fichada.create({
      data: {
        legajoId,
        fecha,
        hora,
        origen: "terminal",
        dispositivoId,
        tipo,
        nivelConfianza: typeof nivelConfianza === "number" ? nivelConfianza : null,
        sincronizada: true, // llegó ahora mismo al servidor — si en Fase 2 la terminal manda fichadas guardadas offline, ese flujo va a mandar sincronizada:false primero y confirmar después
      },
    });

    await prisma.dispositivoAsistencia.update({ where: { id: dispositivoId }, data: { ultimaConexion: new Date(), ultimaSincronizacion: new Date() } });

    return NextResponse.json({
      ok: true,
      fichadaId: fichada.id,
      tipo,
      legajo: { numero: legajo.numeroLegajo, apellido: legajo.apellido, nombre: legajo.nombre },
      hora,
    });
  } catch (e: any) {
    console.error("Error en POST /api/fichadas/terminal:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al registrar la fichada." }, { status: 500 });
  }
}
