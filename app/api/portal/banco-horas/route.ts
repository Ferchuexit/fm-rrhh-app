// FM RRHH — app/api/portal/banco-horas/route.ts
// Desde el portal, el empleado:
//   accion "aceptar" → acepta su acuerdo de banco de horas (queda la fecha,
//                      la hora y desde dónde)
//   accion "pedir"   → pide usar horas (un franco, salir antes) o cobrarlas
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, ipDelPedido } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { avisarARRHH } from "@/lib/avisos";
import { bancoDelEmpleado, pedirDesdePortal, validarPedido, textoHoras } from "@/lib/banco-horas";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const hoy = hoyArgentina();

    if (body.accion === "aceptar") {
      const { count } = await prisma.acuerdoBancoHoras.updateMany({ where: { id: String(body.id ?? ""), legajoId: sesion.legajoId, aceptadoEn: null, enPapel: false, finalizadoEn: null }, data: { aceptadoEn: new Date(), aceptadoIp: ipDelPedido() } });
      if (count === 0) return NextResponse.json({ error: "Ese acuerdo ya estaba aceptado o no está disponible." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "pedir") {
      const datos = await bancoDelEmpleado(sesion.legajoId, hoy);
      if (!datos) return NextResponse.json({ error: "No tenés banco de horas." }, { status: 400 });
      const v = validarPedido(body, datos.disponible, hoy);
      if (!v.datos) return NextResponse.json({ error: v.error }, { status: 400 });
      const r = await pedirDesdePortal(sesion.legajoId, v.datos, hoy);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
      const yo = await prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { apellido: true, nombre: true, empresaId: true, centroCostoId: true } });
      if (yo) {
        const dia = v.datos.fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
        await avisarARRHH(yo.empresaId, yo.centroCostoId, "banco_horas", {
          tipo: "banco_horas",
          titulo: `Pedido de banco de horas: ${yo.apellido}, ${yo.nombre}`,
          cuerpo: v.datos.tipo === "pago" ? `Pidió cobrar ${textoHoras(v.datos.minutos)} de su banco de horas.` : `Pidió usar ${textoHoras(v.datos.minutos)} de su banco de horas el ${dia}.`,
          url: "/banco-horas",
        });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    console.error("Error en POST /api/portal/banco-horas:", e);
    return NextResponse.json({ error: "No se pudo completar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
