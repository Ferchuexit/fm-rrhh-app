// FM RRHH — app/api/portal/chat/route.ts
// El chat del empleado.
//   GET  → sus conversaciones con lo que tiene sin leer
//   POST { con: "rrhh" }       → abre su consulta con RR.HH.
//   POST { con: "<legajoId>" } → abre la charla con un compañero
import { NextResponse } from "next/server";
import { obtenerSesionPortal } from "@/lib/portal";
import { conversacionesDe, conversacionConRRHH, conversacionDirecta } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    return NextResponse.json({ conversaciones: await conversacionesDe(sesion.legajoId) });
  } catch (e) {
    console.error("Error en GET /api/portal/chat:", e);
    return NextResponse.json({ error: "No se pudo cargar el chat." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.con === "rrhh") return NextResponse.json({ id: (await conversacionConRRHH(sesion.empresaId, sesion.legajoId)).id });
    const r = await conversacionDirecta(sesion.legajoId, String(body.con ?? ""));
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e) {
    console.error("Error en POST /api/portal/chat:", e);
    return NextResponse.json({ error: "No se pudo abrir la conversación." }, { status: 500 });
  }
}
