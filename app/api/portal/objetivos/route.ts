// FM RRHH — app/api/portal/objetivos/route.ts
// El jefe le carga un objetivo a alguien de SU equipo (uno o varios).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { crearObjetivos } from "@/lib/objetivos";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const pedidos = [...new Set<string>((Array.isArray(body.legajoIds) ? body.legajoIds : []).map(String))];
    // Solo gente que le reporta directo: sale de la base, no del pedido.
    const equipo = await prisma.legajo.findMany({ where: { id: { in: pedidos }, jefeId: sesion.legajoId, condicion: "activo" }, select: { id: true } });
    if (equipo.length !== pedidos.length) return NextResponse.json({ error: "Solo podés cargar objetivos a la gente de tu equipo." }, { status: 403 });
    const r = await crearObjetivos(equipo.map((l) => l.id), body, `jefe: ${sesion.nombre}`);
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e) {
    console.error("Error en POST /api/portal/objetivos:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
