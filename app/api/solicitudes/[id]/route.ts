// FM RRHH — app/api/solicitudes/[id]/route.ts
// RR.HH. aprueba o rechaza un pedido.
//
// Aprobar VACACIONES crea la Vacacion de siempre, en la misma transacción
// que marca el pedido como aprobado: o pasan las dos cosas o ninguna. Desde
// ahí la vacación aparece en /vacaciones (Gantt, pendientes, notificación
// en PDF) igual que si se hubiera cargado a mano.
//
// Aprobar un PERMISO solo deja la constancia. No toca la grilla de
// asistencia: qué código corresponde (con o sin goce, etc.) lo decide
// RR.HH. en /asistencia.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { rangosOcupados } from "@/lib/ausencias";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });

    const { accion, respuesta, anioCorresponde } = await req.json();
    const comentario = String(respuesta ?? "").trim().slice(0, 500);
    if (accion !== "aprobar" && accion !== "rechazar") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    if (accion === "rechazar" && comentario.length < 5) {
      return NextResponse.json({ error: "Al rechazar, escribí el motivo: es lo que va a leer quien hizo el pedido." }, { status: 400 });
    }

    const solicitud = await prisma.solicitudAusencia.findFirst({ where: { id: params.id, legajo: { empresaId: empresa.id } } });
    if (!solicitud) return NextResponse.json({ error: "No se encontró ese pedido en la empresa actual." }, { status: 404 });
    if (solicitud.estado !== "pendiente") return NextResponse.json({ error: `Ese pedido ya está ${solicitud.estado}.` }, { status: 409 });

    const resuelto = { respuesta: comentario || null, resueltoPor: sesion.email, resueltoEn: new Date() };

    if (accion === "rechazar") {
      const { count } = await prisma.solicitudAusencia.updateMany({ where: { id: solicitud.id, estado: "pendiente" }, data: { estado: "rechazada", ...resuelto } });
      if (count === 0) return NextResponse.json({ error: "Ese pedido ya fue respondido." }, { status: 409 });
      return NextResponse.json({ ok: true, estado: "rechazada" });
    }

    // Entre que el empleado pidió y RR.HH. aprueba, alguien pudo haber
    // cargado una vacación a mano para esas mismas fechas.
    const choques = await rangosOcupados(solicitud.legajoId, solicitud.fechaDesde, solicitud.fechaHasta, solicitud.id);
    if (choques.length > 0) {
      return NextResponse.json({ error: `No se puede aprobar: las fechas se pisan con ${choques[0].descripcion}.` }, { status: 409 });
    }

    const anio = Number(anioCorresponde) || solicitud.fechaDesde.getUTCFullYear();
    await prisma.$transaction(async (tx) => {
      // Primero se "gana" el pedido: si dos personas aprueban a la vez, la
      // segunda no encuentra nada pendiente y no se crea una vacación doble.
      const { count } = await tx.solicitudAusencia.updateMany({ where: { id: solicitud.id, estado: "pendiente" }, data: { estado: "aprobada", ...resuelto } });
      if (count === 0) throw new Error("YA_RESPONDIDA");
      if (solicitud.tipo === "vacaciones") {
        const vacacion = await tx.vacacion.create({
          data: { legajoId: solicitud.legajoId, anioCorresponde: anio, diasCorresponden: solicitud.dias, fechaDesde: solicitud.fechaDesde, fechaHasta: solicitud.fechaHasta },
        });
        await tx.solicitudAusencia.update({ where: { id: solicitud.id }, data: { vacacionId: vacacion.id } });
      }
    });
    return NextResponse.json({ ok: true, estado: "aprobada" });
  } catch (e: any) {
    if (e.message === "YA_RESPONDIDA") return NextResponse.json({ error: "Ese pedido ya fue respondido." }, { status: 409 });
    console.error("Error en POST /api/solicitudes/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo responder el pedido." }, { status: 500 });
  }
}
