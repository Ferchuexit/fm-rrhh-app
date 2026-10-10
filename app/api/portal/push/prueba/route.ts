// El empleado se manda un aviso de prueba a sí mismo, para confirmar que
// le llegan. Limitado a uno por minuto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { avisar, avisoDePrueba } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const reciente = await prisma.aviso.count({ where: { legajoId: sesion.legajoId, tipo: "prueba", createdAt: { gt: new Date(Date.now() - 60 * 1000) } } });
    if (reciente > 0) return NextResponse.json({ error: "Ya te mandamos uno recién. Esperá un minuto y probá de nuevo." }, { status: 429 });
    const r = await avisar([sesion.legajoId], avisoDePrueba());
    if (r.push === 0 && r.mails === 0) return NextResponse.json({ error: "No salió ningún aviso. Desactivá y volvé a activar los avisos en este celular." }, { status: 502 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("Error en POST /api/portal/push/prueba:", e);
    return NextResponse.json({ error: "No se pudo mandar la prueba. Probá de nuevo en un momento." }, { status: 500 });
  }
}
