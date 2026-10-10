// FM RRHH — app/api/objetivos/plan/route.ts
// Plan de carrera de una persona: a qué puesto apunta y qué habilidades de
// la matriz necesita. Uno por persona; guardar lo reemplaza.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto } from "@/lib/ausencias-reglas";
import { limpiarRequisitos } from "@/lib/objetivos";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const legajo = await prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true } });
    if (!legajo) return NextResponse.json({ error: "No se encontró ese legajo." }, { status: 404 });

    if (body.accion === "borrar") {
      await prisma.planCarrera.deleteMany({ where: { legajoId: legajo.id } });
      return NextResponse.json({ ok: true });
    }
    const puestoObjetivo = String(body.puestoObjetivo ?? "").trim().slice(0, 80);
    if (puestoObjetivo.length < 3) return NextResponse.json({ error: "Escribí a qué puesto apunta (por ejemplo: Oficial tornero, Líder de turno)." }, { status: 400 });
    const fechaObjetivo = body.fechaObjetivo ? fechaDesdeTexto(body.fechaObjetivo) : null;
    if (body.fechaObjetivo && !fechaObjetivo) return NextResponse.json({ error: "La fecha no es válida." }, { status: 400 });
    const habilidades = await prisma.habilidad.findMany({ where: { empresaId: empresa.id }, select: { id: true } });
    const { requisitos, error } = limpiarRequisitos(body.requisitos, new Set(habilidades.map((h) => h.id)));
    if (error) return NextResponse.json({ error }, { status: 400 });

    const data = { puestoObjetivo, fechaObjetivo, notas: String(body.notas ?? "").trim().slice(0, 1000) || null, requisitos: requisitos as any, actualizadoPor: sesion.email };
    await prisma.planCarrera.upsert({ where: { legajoId: legajo.id }, create: { legajoId: legajo.id, ...data }, update: data });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/objetivos/plan:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar el plan. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
