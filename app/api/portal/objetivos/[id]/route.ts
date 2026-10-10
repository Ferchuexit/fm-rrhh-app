// FM RRHH — app/api/portal/objetivos/[id]/route.ts
// Desde el portal, sobre UN objetivo:
//   avance → el dueño del objetivo o su jefe informan cómo viene.
//   cerrar → solo el jefe (nadie se da por cumplido a sí mismo).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { informarAvance, cerrarObjetivo } from "@/lib/objetivos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const o = await prisma.objetivo.findFirst({ where: { id: params.id, OR: [{ legajoId: sesion.legajoId }, { legajo: { jefeId: sesion.legajoId } }] }, select: { id: true, legajoId: true } });
    if (!o) return NextResponse.json({ error: "No se encontró ese objetivo." }, { status: 404 });
    const esJefe = o.legajoId !== sesion.legajoId;

    let r;
    if (body.accion === "avance") r = await informarAvance(o.id, body, esJefe ? `jefe: ${sesion.nombre}` : "empleado");
    else if (body.accion === "cerrar") r = esJefe ? await cerrarObjetivo(o.id, body, `jefe: ${sesion.nombre}`) : { error: "El objetivo lo cierra tu jefe o RR.HH.", status: 403 };
    else r = { error: "Acción inválida.", status: 400 };
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e) {
    console.error("Error en POST /api/portal/objetivos/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
