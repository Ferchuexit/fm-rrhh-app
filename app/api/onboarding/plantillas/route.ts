// Alta, edición y baja de plantillas de ingreso de la empresa actual.
// Cambiar una plantilla NO modifica los ingresos ya iniciados: cada uno
// lleva su propia copia de las tareas.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { limpiarTareas } from "@/lib/ingresos";

export const dynamic = "force-dynamic";
const fallo = (e: any, accion: string) => (e?.name === "FueraDeAlcance" ? NextResponse.json({ error: "Las plantillas de la empresa las define RR.HH." }, { status: 403 }) : NextResponse.json({ error: `No se pudo ${accion} la plantilla. Probá de nuevo en un momento.` }, { status: 500 }));

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const nombre = String(body.nombre ?? "").trim().slice(0, 60);
    if (nombre.length < 3) return NextResponse.json({ error: "Ponele un nombre a la plantilla (por ejemplo: Operarios de planta)." }, { status: 400 });
    const { tareas, error } = limpiarTareas(body.tareas);
    if (error) return NextResponse.json({ error }, { status: 400 });

    if (body.id) {
      const { count } = await prisma.plantillaIngreso.updateMany({ where: { id: String(body.id), empresaId: empresa.id }, data: { nombre, tareas: tareas as any } });
      if (count === 0) return NextResponse.json({ error: "Esa plantilla ya no existe." }, { status: 404 });
      return NextResponse.json({ ok: true, id: body.id });
    }
    const creada = await prisma.plantillaIngreso.create({ data: { empresaId: empresa.id, nombre, tareas: tareas as any } });
    return NextResponse.json({ ok: true, id: creada.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya hay una plantilla con ese nombre." }, { status: 409 });
    console.error("Error en POST /api/onboarding/plantillas:", e);
    return fallo(e, "guardar");
  }
}

export async function DELETE(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    if ((await prisma.plantillaIngreso.count({ where: { empresaId: empresa.id } })) <= 1) return NextResponse.json({ error: "Es la única plantilla: editala en vez de borrarla." }, { status: 409 });
    const { count } = await prisma.plantillaIngreso.deleteMany({ where: { id: new URL(req.url).searchParams.get("id") ?? "", empresaId: empresa.id } });
    if (count === 0) return NextResponse.json({ error: "Esa plantilla ya no existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/onboarding/plantillas:", e);
    return fallo(e, "borrar");
  }
}
