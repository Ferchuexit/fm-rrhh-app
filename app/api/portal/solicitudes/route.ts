// FM RRHH — app/api/portal/solicitudes/route.ts
// Pedido de vacaciones o permiso. Queda "pendiente" hasta que RR.HH.
// responda en /solicitudes — acá no se registra ninguna vacación.
//
// Quién pide qué:
//   - Las VACACIONES de alguien que tiene jefe las pide el jefe (es quien
//     coordina la producción), mandando `paraLegajoId`. RR.HH. decide.
//   - Quien no tiene jefe cargado pide las suyas, como siempre.
//   - Los PERMISOS los pide siempre el propio empleado.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { puedePedirParaSi } from "@/lib/equipo";
import { avisar, avisarPedidoNuevoARRHH, avisoPedidoDelJefe } from "@/lib/avisos";
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

    // ¿Para quién es? Si viene paraLegajoId, tiene que ser alguien que hoy
    // reporta DIRECTO a quien está logueado — se verifica contra la base,
    // nunca se confía en lo que manda el navegador.
    const paraOtro = typeof body.paraLegajoId === "string" && body.paraLegajoId !== "" && body.paraLegajoId !== sesion.legajoId;
    let legajoId = sesion.legajoId;
    if (paraOtro) {
      const miembro = await prisma.legajo.findFirst({ where: { id: body.paraLegajoId, jefeId: sesion.legajoId, condicion: "activo" }, select: { id: true } });
      if (!miembro) return NextResponse.json({ error: "Esa persona no figura en tu equipo. Si es un error, avisale a RR.HH." }, { status: 403 });
      legajoId = miembro.id;
    } else {
      const yo = await prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { jefe: { select: { nombre: true, apellido: true } } } });
      if (!puedePedirParaSi(String(body.tipo), !!yo?.jefe)) {
        return NextResponse.json({ error: `Las vacaciones las pide tu jefe (${yo!.jefe!.nombre} ${yo!.jefe!.apellido}). Coordiná las fechas con él.` }, { status: 403 });
      }
    }

    const saldo = desde ? await saldoVacaciones(legajoId, desde.getUTCFullYear()) : null;
    const ocupados = desde && hasta && hasta >= desde ? await rangosOcupados(legajoId, desde, hasta) : [];
    const error = validarPedido({ tipo: body.tipo, desde, hasta, motivo, hoy: hoyArgentina(), saldoDisponible: saldo?.disponibles ?? 0, ocupados, paraOtro });
    if (error) return NextResponse.json({ error }, { status: 400 });

    const solicitud = await prisma.solicitudAusencia.create({
      data: { legajoId, solicitadoPorId: paraOtro ? sesion.legajoId : null, tipo: body.tipo, fechaDesde: desde!, fechaHasta: hasta!, dias: diasCorridos(desde!, hasta!), motivo: motivo || null },
    });
    // Avisos: a RR.HH. que hay un pedido para responder, y al empleado si
    // se lo cargó su jefe.
    const persona = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { nombre: true, apellido: true, empresaId: true, centroCostoId: true } });
    if (persona) {
      await avisarPedidoNuevoARRHH({
        empresaId: persona.empresaId, centroCostoId: persona.centroCostoId, empleado: `${persona.nombre} ${persona.apellido}`,
        tipo: solicitud.tipo, desde: solicitud.fechaDesde, hasta: solicitud.fechaHasta, pedidoPor: paraOtro ? sesion.nombre : null,
      });
      if (paraOtro) await avisar([legajoId], avisoPedidoDelJefe(solicitud.fechaDesde, solicitud.fechaHasta));
    }
    return NextResponse.json({ ok: true, id: solicitud.id });
  } catch (e: any) {
    console.error("Error en POST /api/portal/solicitudes:", e);
    return NextResponse.json({ error: "No se pudo enviar el pedido. Probá de nuevo en un momento." }, { status: 500 });
  }
}
