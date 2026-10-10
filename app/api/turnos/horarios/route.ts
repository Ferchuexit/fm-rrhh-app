// FM RRHH — app/api/turnos/horarios/route.ts
// Alta, edición y baja de los horarios de trabajo de la empresa actual.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { limpiarDias, COLORES_HORARIO } from "@/lib/turnos";

export const dynamic = "force-dynamic";
const errorDe = (e: any, accion: string) => (e?.name === "FueraDeAlcance" ? NextResponse.json({ error: "Los horarios de la empresa los define RR.HH. Vos podés asignar los que ya existen." }, { status: 403 }) : NextResponse.json({ error: `No se pudo ${accion} el horario. Probá de nuevo en un momento.` }, { status: 500 }));

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const nombre = String(body.nombre ?? "").trim().slice(0, 40);
    if (nombre.length < 2) return NextResponse.json({ error: "Ponele un nombre al horario (por ejemplo: Mañana)." }, { status: 400 });
    const { dias, error } = limpiarDias(body.dias);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const color = COLORES_HORARIO.includes(body.color) ? body.color : COLORES_HORARIO[0];

    // Editar un horario cambia lo que les toca a quienes lo tienen asignado,
    // también hacia atrás: por eso la pantalla lo avisa antes de guardar.
    if (body.id) {
      const { count } = await prisma.horarioTrabajo.updateMany({ where: { id: String(body.id), empresaId: empresa.id }, data: { nombre, color, dias } });
      if (count === 0) return NextResponse.json({ error: "Ese horario ya no existe." }, { status: 404 });
      return NextResponse.json({ ok: true, id: body.id });
    }
    const creado = await prisma.horarioTrabajo.create({ data: { empresaId: empresa.id, nombre, color, dias } });
    return NextResponse.json({ ok: true, id: creado.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya hay un horario con ese nombre." }, { status: 409 });
    console.error("Error en POST /api/turnos/horarios:", e);
    return errorDe(e, "guardar");
  }
}

export async function DELETE(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const id = new URL(req.url).searchParams.get("id") ?? "";
    // Si alguien lo tiene (o lo tuvo), no se borra: la asistencia de esas
    // fechas se quedaría sin horario contra el cual comparar.
    const enUso = await prisma.asignacionHorario.count({ where: { horarioIds: { has: id }, legajo: { empresaId: empresa.id } } });
    if (enUso > 0) return NextResponse.json({ error: `Este horario está asignado (o lo estuvo) a ${enUso === 1 ? "una persona" : `${enUso} asignaciones`}. No se puede borrar: asignales otro, y dejá este sin usar.` }, { status: 409 });
    const { count } = await prisma.horarioTrabajo.deleteMany({ where: { id, empresaId: empresa.id } });
    if (count === 0) return NextResponse.json({ error: "Ese horario ya no existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/turnos/horarios:", e);
    return errorDe(e, "borrar");
  }
}
