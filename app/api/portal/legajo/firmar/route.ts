// FM RRHH — app/api/portal/legajo/firmar/route.ts
// El empleado firma con su PIN una constancia que generó el sistema: la
// ficha, la DD.JJ. de domicilio o la notificación de una vacación.
//
// El navegador manda la HUELLA de lo que le mostró al empleado, y acá se
// compara contra la de los datos de este momento. Si RR.HH. cambió algo
// entre que abrió la pantalla y tocó "firmar", no coincide y se le pide
// que mire de nuevo — nadie firma un texto distinto al que leyó.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, verificarPinDeFirma, ipDelPedido, soloDigitos } from "@/lib/portal";
import { cargarLegajoDigital } from "@/lib/legajo-digital";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    const { legajo, paraFirmar } = await cargarLegajoDigital(sesion.legajoId);
    const item = paraFirmar.find((p) => p.clave === body.clave);
    if (!item) return NextResponse.json({ error: "Eso ya está firmado, o no hay nada para firmar." }, { status: 409 });
    if (item.hash !== body.hash) return NextResponse.json({ error: "Los datos cambiaron mientras tenías la pantalla abierta. Actualizá la página y revisalos de nuevo antes de firmar." }, { status: 409 });

    const errorPin = await verificarPinDeFirma(sesion.legajoId, soloDigitos(body.pin));
    if (errorPin) return NextResponse.json({ error: errorPin.error }, { status: errorPin.status });

    await prisma.constanciaFirmada.create({
      data: {
        legajoId: legajo.id, tipo: item.tipo, vacacionId: item.vacacionId ?? null,
        contenido: item.contenido as any, hashContenido: item.hash,
        ipFirma: ipDelPedido(), userAgentFirma: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/portal/legajo/firmar:", e);
    return NextResponse.json({ error: "No se pudo registrar la firma. Probá de nuevo en un momento." }, { status: 500 });
  }
}
