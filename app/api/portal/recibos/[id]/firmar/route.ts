// FM RRHH — app/api/portal/recibos/[id]/firmar/route.ts
// Firma del recibo por el empleado: en conformidad o en disconformidad.
//
// Qué queda guardado, y por qué cada cosa:
//   - el PIN se vuelve a pedir en este mismo acto → no alcanza con haber
//     dejado el celular desbloqueado con la sesión abierta
//   - fecha y hora, IP y navegador → cuándo y desde dónde
//   - hashContenido → qué decía exactamente el recibo que firmó
// La firma no se puede cambiar ni borrar desde ninguna pantalla.
//
// Firmar en DISCONFORMIDAD exige escribir el motivo: es el canal para que
// el empleado deje asentado su reclamo sin negarse a recibir el recibo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPassword } from "@/lib/auth";
import { obtenerSesionPortal, liquidacionDelEmpleado, hashContenidoRecibo, ipDelPedido, soloDigitos, MAX_INTENTOS_PIN, MINUTOS_BLOQUEO_PIN } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tipo = body.tipo;
    const observacion = String(body.observacion ?? "").trim().slice(0, 1000);
    const pin = soloDigitos(body.pin);

    if (tipo !== "conforme" && tipo !== "disconforme") {
      return NextResponse.json({ error: "Elegí si firmás en conformidad o en disconformidad." }, { status: 400 });
    }
    if (tipo === "disconforme" && observacion.length < 10) {
      return NextResponse.json({ error: "Para firmar en disconformidad, contá en pocas palabras con qué no estás de acuerdo." }, { status: 400 });
    }

    const liq = await liquidacionDelEmpleado(params.id, sesion.legajoId);
    if (!liq) return NextResponse.json({ error: "No se encontró ese recibo." }, { status: 404 });
    if (liq.reciboDigital?.firma) {
      return NextResponse.json({ error: "Este recibo ya está firmado." }, { status: 409 });
    }

    const acceso = await prisma.accesoPortal.findUnique({ where: { legajoId: sesion.legajoId } });
    if (!acceso || !acceso.activo) return NextResponse.json({ error: "Tu acceso al portal no está activo. Consultá con RR.HH." }, { status: 403 });
    if (acceso.bloqueadoHasta && acceso.bloqueadoHasta > new Date()) {
      return NextResponse.json({ error: "Demasiados intentos con el PIN. Esperá unos minutos y probá de nuevo." }, { status: 429 });
    }
    if (!(await verificarPassword(pin, acceso.pinHash))) {
      const intentos = acceso.intentosFallidos + 1;
      await prisma.accesoPortal.update({
        where: { id: acceso.id },
        data: {
          intentosFallidos: intentos >= MAX_INTENTOS_PIN ? 0 : intentos,
          bloqueadoHasta: intentos >= MAX_INTENTOS_PIN ? new Date(Date.now() + MINUTOS_BLOQUEO_PIN * 60000) : null,
        },
      });
      return NextResponse.json({ error: "El PIN no es correcto." }, { status: 401 });
    }
    if (acceso.intentosFallidos > 0) {
      await prisma.accesoPortal.update({ where: { id: acceso.id }, data: { intentosFallidos: 0 } });
    }

    const hash = await hashContenidoRecibo(liq.id, liq.version, liq.legajoId, liq.periodoId);
    const ahora = new Date();
    const datosFirma = {
      firma: tipo,
      firmadoEn: ahora,
      observacion: observacion || null,
      ipFirma: ipDelPedido(),
      userAgentFirma: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
      hashContenido: hash,
    };

    // Dos pasos a propósito: primero asegura que la fila exista, después
    // firma SOLO si sigue sin firma. Si llegan dos pedidos a la vez (doble
    // toque en el botón), el segundo no pisa al primero.
    await prisma.reciboDigital.upsert({
      where: { liquidacionId: liq.id },
      create: { liquidacionId: liq.id, legajoId: liq.legajoId, primeraVistaEn: ahora },
      update: {},
    });
    const { count } = await prisma.reciboDigital.updateMany({ where: { liquidacionId: liq.id, firma: null }, data: datosFirma });
    if (count === 0) return NextResponse.json({ error: "Este recibo ya está firmado." }, { status: 409 });

    return NextResponse.json({ ok: true, firma: tipo, firmadoEn: ahora });
  } catch (e: any) {
    console.error("Error en POST /api/portal/recibos/[id]/firmar:", e);
    return NextResponse.json({ error: "No se pudo registrar la firma. Probá de nuevo en un momento." }, { status: 500 });
  }
}
