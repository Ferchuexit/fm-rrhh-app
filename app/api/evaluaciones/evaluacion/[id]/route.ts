// FM RRHH — app/api/evaluaciones/evaluacion/[id]/route.ts
// RR.HH. completa o corrige UNA evaluación desde el panel: las de quien no
// tiene jefe, o cualquiera que haga falta ajustar antes de entregarla.
// Una vez entregada al empleado ya no se modifica: es lo que él leyó.
//   guardar   → borrador
//   completar → queda lista para entregar
//   devolver  → una completada vuelve a "sin completar" (el jefe la rehace)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { datosDeEvaluacion, type Competencia } from "@/lib/evaluaciones";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const ev = await prisma.evaluacion.findFirst({ where: { id: params.id, ciclo: { empresaId: empresa.id } }, include: { ciclo: { select: { competencias: true } } } });
    if (!ev) return NextResponse.json({ error: "No se encontró esa evaluación." }, { status: 404 });
    if (ev.estado === "entregada" || ev.estado === "firmada") return NextResponse.json({ error: "Esa evaluación ya se le entregó al empleado: no se modifica." }, { status: 409 });

    let data: Record<string, unknown>;
    if (body.accion === "devolver") {
      data = { estado: "pendiente", promedio: null, completadaPor: null, completadaEn: null };
    } else if (body.accion === "guardar" || body.accion === "completar") {
      const r = datosDeEvaluacion(ev.ciclo.competencias as unknown as Competencia[], body, body.accion === "completar", sesion.email);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      data = r.data;
    } else return NextResponse.json({ error: "Acción inválida." }, { status: 400 });

    const { count } = await prisma.evaluacion.updateMany({ where: { id: ev.id, estado: { in: ["pendiente", "completada"] } }, data });
    if (count === 0) return NextResponse.json({ error: "Otra persona la acaba de entregar. Recargá la página." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/evaluaciones/evaluacion/[id]:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
