// FM RRHH — app/api/portal/solicitudes/route.ts
// El empleado pide vacaciones o un permiso. Queda "pendiente" hasta que
// RR.HH. responda en /solicitudes — acá no se registra ninguna vacación.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { fechaDesdeTexto, hoyArgentina, diasCorridos, validarPedido, saldoVacaciones, rangosOcupados } from "@/lib/ausencias";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const desde = fechaDesdeTexto(body.fechaDesde);
    const hasta = fechaDesdeTexto(body.fechaHasta);
    const motivo = String(body.motivo ?? "").trim().slice(0, 500);

    const saldo = desde ? await saldoVacaciones(sesion.legajoId, desde.getUTCFullYear()) : null;
    const ocupados = desde && hasta && hasta >= desde ? await rangosOcupados(sesion.legajoId, desde, hasta) : [];
    const error = validarPedido({ tipo: body.tipo, desde, hasta, motivo, hoy: hoyArgentina(), saldoDisponible: saldo?.disponibles ?? 0, ocupados });
    if (error) return NextResponse.json({ error }, { status: 400 });

    const solicitud = await prisma.solicitudAusencia.create({
      data: { legajoId: sesion.legajoId, tipo: body.tipo, fechaDesde: desde!, fechaHasta: hasta!, dias: diasCorridos(desde!, hasta!), motivo: motivo || null },
    });
    return NextResponse.json({ ok: true, id: solicitud.id });
  } catch (e: any) {
    console.error("Error en POST /api/portal/solicitudes:", e);
    return NextResponse.json({ error: "No se pudo enviar el pedido. Probá de nuevo en un momento." }, { status: 500 });
  }
}
