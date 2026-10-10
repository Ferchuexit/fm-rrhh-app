// FM RRHH — app/api/evaluaciones/[id]/route.ts
// Un ciclo: ver sus evaluaciones y actuar sobre él.
//   entregar → las completadas pasan a "entregada": recién ahí el empleado
//              la ve en el portal y recibe el aviso para firmarla.
//              Con `ids` entrega esas; sin `ids`, todas las completadas.
//   cerrar   → el ciclo no admite más cambios de los evaluadores. Lo ya
//              entregado se puede seguir firmando.
//   reabrir  → vuelve a admitirlos.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { resumenCiclo, type Competencia } from "@/lib/evaluaciones";
import { avisar, avisoEvaluacionEntregada } from "@/lib/avisos";

export const dynamic = "force-dynamic";

const fuera = (e: any, donde: string) => {
  console.error(`Error en ${donde}:`, e);
  return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo completar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const ciclo = await prisma.cicloEvaluacion.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!ciclo) return NextResponse.json({ error: "No se encontró ese ciclo." }, { status: 404 });
    const evaluaciones = await prisma.evaluacion.findMany({
      where: { cicloId: ciclo.id },
      include: { legajo: { select: { numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } } }, evaluador: { select: { apellido: true, nombre: true } } },
      orderBy: [{ legajo: { apellido: "asc" } }, { legajo: { nombre: "asc" } }],
    });
    return NextResponse.json({ ciclo, evaluaciones: evaluaciones.map(({ firmaIp, ...e }) => e), resumen: resumenCiclo(ciclo.competencias as unknown as Competencia[], evaluaciones) });
  } catch (e) {
    return fuera(e, "GET /api/evaluaciones/[id]");
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const ciclo = await prisma.cicloEvaluacion.findFirst({ where: { id: params.id, empresaId: empresa.id }, select: { id: true, estado: true } });
    if (!ciclo) return NextResponse.json({ error: "No se encontró ese ciclo." }, { status: 404 });

    if (body.accion === "cerrar" || body.accion === "reabrir") {
      const cerrar = body.accion === "cerrar";
      await prisma.cicloEvaluacion.update({ where: { id: ciclo.id }, data: { estado: cerrar ? "cerrado" : "abierto", cerradoEn: cerrar ? new Date() : null } });
      return NextResponse.json({ ok: true });
    }
    if (body.accion !== "entregar") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });

    const ids = Array.isArray(body.ids) ? body.ids.map(String) : null;
    const paraEntregar = await prisma.evaluacion.findMany({ where: { cicloId: ciclo.id, estado: "completada", ...(ids ? { id: { in: ids } } : {}) }, select: { id: true, legajoId: true } });
    if (paraEntregar.length === 0) return NextResponse.json({ error: "No hay evaluaciones completadas para entregar." }, { status: 400 });
    // El filtro por estado se repite al escribir: si dos personas entregan
    // a la vez, cada evaluación se entrega (y se avisa) una sola vez.
    const entregadas: string[] = [];
    for (const e of paraEntregar) {
      const { count } = await prisma.evaluacion.updateMany({ where: { id: e.id, estado: "completada" }, data: { estado: "entregada", entregadaEn: new Date() } });
      if (count) entregadas.push(e.legajoId);
    }
    await avisar(entregadas, avisoEvaluacionEntregada());
    return NextResponse.json({ ok: true, entregadas: entregadas.length });
  } catch (e) {
    return fuera(e, "POST /api/evaluaciones/[id]");
  }
}
