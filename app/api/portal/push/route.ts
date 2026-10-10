// FM RRHH — app/api/portal/push/route.ts
// El empleado activa o desactiva los avisos en el celular que tiene en la
// mano. GET dice si el sistema los tiene configurados y entrega la llave
// pública que el navegador necesita para suscribirse.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { clavePublicaPush, nombreDispositivo, endpointPushValido } from "@/lib/avisos";

export const dynamic = "force-dynamic";
const MAX_DISPOSITIVOS = 5;

export async function GET() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
  try {
    const dispositivos = await prisma.suscripcionPush.findMany({ where: { legajoId: sesion.legajoId }, select: { endpoint: true, dispositivo: true, createdAt: true }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ clavePublica: clavePublicaPush(), dispositivos });
  } catch (e) {
    // Falta aplicar la migración de avisos: el portal sigue andando, solo
    // que no ofrece activarlos.
    console.error("Error en GET /api/portal/push:", e);
    return NextResponse.json({ clavePublica: null, dispositivos: [] });
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    if (!clavePublicaPush()) return NextResponse.json({ error: "Los avisos todavía no están habilitados. Avisale a RR.HH." }, { status: 503 });

    const s = (await req.json().catch(() => ({})))?.suscripcion;
    const endpoint = String(s?.endpoint ?? "");
    const p256dh = String(s?.keys?.p256dh ?? "");
    const auth = String(s?.keys?.auth ?? "");
    // PUSH_HOSTS_EXTRA (separados por coma) existe solo para probar contra
    // un servicio simulado; en producción no se configura.
    const extra = (process.env.PUSH_HOSTS_EXTRA ?? "").split(",").map((h) => h.trim()).filter(Boolean);
    if (!endpointPushValido(endpoint, extra) || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
      return NextResponse.json({ error: "El celular no entregó los datos para avisarte. Probá de nuevo." }, { status: 400 });
    }

    const datos = { legajoId: sesion.legajoId, p256dh, auth, dispositivo: nombreDispositivo(req.headers.get("user-agent") ?? "") };
    // Si ese celular estaba a nombre de otro empleado (lo usó otra persona
    // antes), pasa a ser de quien lo activa ahora.
    await prisma.suscripcionPush.upsert({ where: { endpoint }, create: { endpoint, ...datos }, update: datos });

    // Tope por persona: se conservan los más nuevos.
    const todas = await prisma.suscripcionPush.findMany({ where: { legajoId: sesion.legajoId }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (todas.length > MAX_DISPOSITIVOS) await prisma.suscripcionPush.deleteMany({ where: { id: { in: todas.slice(MAX_DISPOSITIVOS).map((t) => t.id) } } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/push:", e);
    return NextResponse.json({ error: "No se pudieron activar los avisos. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const endpoint = String((await req.json().catch(() => ({})))?.endpoint ?? "");
    await prisma.suscripcionPush.deleteMany({ where: { endpoint, legajoId: sesion.legajoId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en DELETE /api/portal/push:", e);
    return NextResponse.json({ error: "No se pudieron desactivar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
