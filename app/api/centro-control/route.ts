import { NextResponse } from "next/server";
import { obtenerCentroControl } from "@/lib/centro-control";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });
  try {
    const resultado = await obtenerCentroControl(periodoId);
    return NextResponse.json(resultado);
  } catch (e: any) {
    console.error("Error en GET /api/centro-control:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo calcular el centro de control." }, { status: 500 });
  }
}
