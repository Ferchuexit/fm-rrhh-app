// FM RRHH — app/api/epp/[legajoId]/route.ts
// El historial de entregas de una persona.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { MOTIVOS_ENTREGA } from "@/lib/epp";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { legajoId: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const legajo = await prisma.legajo.findFirst({ where: { id: params.legajoId, empresaId: empresa.id }, select: { id: true } });
    if (!legajo) return NextResponse.json({ error: "No se encontró esa persona." }, { status: 404 });
    const entregas = await prisma.entregaEpp.findMany({ where: { legajoId: legajo.id }, orderBy: [{ fechaEntrega: "desc" }, { createdAt: "desc" }], take: 300 });
    return NextResponse.json({ entregas: entregas.map((e) => ({ id: e.id, elementoId: e.elementoId, producto: e.producto, tipoModelo: e.tipoModelo, marca: e.marca, cantidad: e.cantidad, talle: e.talle, fechaEntrega: e.fechaEntrega, vence: e.vence, motivo: MOTIVOS_ENTREGA[e.motivo] ?? e.motivo, observacion: e.observacion, entregadoPor: e.entregadoPor, firmadoEn: e.firmadoEn, enPapel: e.enPapel })) });
  } catch (e) {
    console.error("Error en GET /api/epp/[legajoId]:", e);
    return NextResponse.json({ error: "No se pudo cargar el historial." }, { status: 500 });
  }
}
