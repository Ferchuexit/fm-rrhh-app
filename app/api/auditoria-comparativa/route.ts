import { NextResponse } from "next/server";
import { obtenerAuditoriaComparativa } from "@/lib/auditoria-comparativa";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });
  try {
    const resultado = await obtenerAuditoriaComparativa(periodoId);
    return NextResponse.json(resultado);
  } catch (e: any) {
    console.error("Error en GET /api/auditoria-comparativa:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo calcular la comparación." }, { status: 500 });
  }
}
