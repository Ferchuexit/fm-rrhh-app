// FM RRHH — app/api/evaluaciones/formularios/route.ts
// Formularios de evaluación (qué competencias se puntúan): crear, editar,
// borrar. Editar o borrar uno NO toca los ciclos ya abiertos: cada ciclo
// guarda su propia copia de las competencias.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { limpiarCompetencias } from "@/lib/evaluaciones";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const id = body.id ? String(body.id) : null;
    if (id && !(await prisma.formularioEvaluacion.findFirst({ where: { id, empresaId: empresa.id }, select: { id: true } }))) return NextResponse.json({ error: "Ese formulario ya no existe. Recargá la página." }, { status: 404 });

    if (body.accion === "borrar") {
      if (!id) return NextResponse.json({ error: "Falta el formulario." }, { status: 400 });
      if ((await prisma.formularioEvaluacion.count({ where: { empresaId: empresa.id } })) <= 1) return NextResponse.json({ error: "Tiene que quedar al menos un formulario." }, { status: 400 });
      await prisma.formularioEvaluacion.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    const nombre = String(body.nombre ?? "").trim().slice(0, 60);
    if (nombre.length < 3) return NextResponse.json({ error: "Ponele un nombre al formulario." }, { status: 400 });
    const { competencias, error } = limpiarCompetencias(body.competencias);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (await prisma.formularioEvaluacion.findFirst({ where: { empresaId: empresa.id, nombre: { equals: nombre, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })) return NextResponse.json({ error: `Ya hay un formulario llamado "${nombre}".` }, { status: 409 });

    const data = { nombre, competencias: competencias as any };
    const f = id ? await prisma.formularioEvaluacion.update({ where: { id }, data }) : await prisma.formularioEvaluacion.create({ data: { empresaId: empresa.id, ...data } });
    return NextResponse.json({ ok: true, id: f.id });
  } catch (e: any) {
    console.error("Error en POST /api/evaluaciones/formularios:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar el formulario. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
