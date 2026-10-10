// FM RRHH — app/api/objetivos/[id]/route.ts
// RR.HH. sobre UN objetivo: informar avance, cerrarlo o reabrirlo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { informarAvance, cerrarObjetivo } from "@/lib/objetivos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const o = await prisma.objetivo.findFirst({ where: { id: params.id, legajo: { empresaId: empresa.id } }, select: { id: true, estado: true } });
    if (!o) return NextResponse.json({ error: "No se encontró ese objetivo." }, { status: 404 });

    if (body.accion === "reabrir") {
      await prisma.objetivo.updateMany({ where: { id: o.id, estado: { not: "en_curso" } }, data: { estado: "en_curso", comentarioCierre: null, cerradoPor: null, cerradoEn: null } });
      return NextResponse.json({ ok: true });
    }
    const r = body.accion === "avance" ? await informarAvance(o.id, body, sesion.email) : body.accion === "cerrar" ? await cerrarObjetivo(o.id, body, sesion.email) : { error: "Acción inválida.", status: 400 };
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e: any) {
    console.error("Error en POST /api/objetivos/[id]:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
