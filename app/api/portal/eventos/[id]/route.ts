// FM RRHH — app/api/portal/eventos/[id]/route.ts
// Un empleado avisa si va o no a un evento (y puede cambiar de opinión
// mientras esté abierta la confirmación).
import { NextResponse } from "next/server";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { responderEvento } from "@/lib/eventos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const r = await responderEvento(params.id, sesion.legajoId, await req.json().catch(() => ({})), hoyArgentina());
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e) {
    console.error("Error en POST /api/portal/eventos/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
