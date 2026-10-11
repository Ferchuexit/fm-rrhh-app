// Aplaudir (o dejar de aplaudir) un reconocimiento del muro de MI empresa.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const r = await prisma.reconocimiento.findFirst({ where: { id: params.id, oculto: false, legajo: { empresaId: sesion.empresaId } }, select: { id: true } });
    if (!r) return NextResponse.json({ error: "Ese reconocimiento ya no está." }, { status: 404 });
    const clave = { reconocimientoId_legajoId: { reconocimientoId: r.id, legajoId: sesion.legajoId } };
    const ya = await prisma.aplausoReconocimiento.findUnique({ where: clave });
    if (ya) await prisma.aplausoReconocimiento.delete({ where: clave });
    else await prisma.aplausoReconocimiento.create({ data: { reconocimientoId: r.id, legajoId: sesion.legajoId } }).catch((e) => { if (e?.code !== "P2002") throw e; });
    return NextResponse.json({ ok: true, aplaudido: !ya, aplausos: await prisma.aplausoReconocimiento.count({ where: { reconocimientoId: r.id } }) });
  } catch (e) {
    console.error("Error en POST /api/portal/reconocimientos/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
