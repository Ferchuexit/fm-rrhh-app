import { NextResponse } from "next/server";
import { obtenerResultadoAuditoriaPreliquidacion } from "@/lib/auditoria-context";

export async function POST(req: Request) {
  try {
    const { periodoId } = await req.json();
    if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });
    const resultado = await obtenerResultadoAuditoriaPreliquidacion(periodoId);
    return NextResponse.json(resultado);
  } catch (e: any) {
    console.error("Error en POST /api/auditar-preliquidacion:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo auditar este período." }, { status: 500 });
  }
}
