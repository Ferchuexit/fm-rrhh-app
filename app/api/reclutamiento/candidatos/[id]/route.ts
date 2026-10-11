// FM RRHH — app/api/reclutamiento/candidatos/[id]/route.ts
// Sobre UN candidato: moverlo de etapa, puntuarlo, anotar, o borrar sus
// datos (si pide que no los guardemos más).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { motivoNoMover } from "@/lib/reclutamiento";
import { avisar, avisoReferidoIngreso } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const c = await prisma.candidato.findFirst({ where: { id: params.id, busqueda: { empresaId: empresa.id } }, select: { id: true, etapa: true, busquedaId: true, referidoPorId: true, busqueda: { select: { vacantes: true, premioReferido: true } } } });
    if (!c) return NextResponse.json({ error: "No se encontró ese candidato." }, { status: 404 });

    if (body.accion === "borrar") {
      await prisma.candidato.delete({ where: { id: c.id } });
      return NextResponse.json({ ok: true });
    }

    const data: Record<string, unknown> = {};
    if (body.etapa !== undefined && body.etapa !== c.etapa) {
      const contratados = await prisma.candidato.count({ where: { busquedaId: c.busquedaId, etapa: "contratado" } });
      const motivo = motivoNoMover(String(body.etapa), body.motivoDescarte, contratados, c.busqueda.vacantes, c.etapa === "contratado");
      if (motivo) return NextResponse.json({ error: motivo }, { status: 400 });
      Object.assign(data, { etapa: body.etapa, etapaDesde: new Date(), motivoDescarte: body.etapa === "descartado" ? body.motivoDescarte : null });
    }
    if (body.puntaje !== undefined) {
      const p = body.puntaje === null ? null : Number(body.puntaje);
      if (p !== null && (!Number.isInteger(p) || p < 1 || p > 5)) return NextResponse.json({ error: "El puntaje va de 1 a 5." }, { status: 400 });
      data.puntaje = p;
    }
    if (body.notas !== undefined) data.notas = String(body.notas ?? "").trim().slice(0, 3000) || null;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "No hay nada para guardar." }, { status: 400 });
    await prisma.candidato.update({ where: { id: c.id }, data });
    // Programa de referidos: a quien lo recomendó se le avisa que entró.
    if (data.etapa === "contratado" && c.referidoPorId) await avisar([c.referidoPorId], avisoReferidoIngreso(c.busqueda.premioReferido));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/reclutamiento/candidatos/[id]:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
