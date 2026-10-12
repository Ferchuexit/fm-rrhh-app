// FM RRHH — app/api/banco-horas/[legajoId]/route.ts
// El banco de horas de una persona: acuerdos, movimientos y lo que tiene.
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { detalleBanco } from "@/lib/banco-horas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { legajoId: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const d = await detalleBanco(params.legajoId, empresa.id, hoyArgentina());
    return d ? NextResponse.json(d) : NextResponse.json({ error: "No se encontró esa persona." }, { status: 404 });
  } catch (e) {
    console.error("Error en GET /api/banco-horas/[legajoId]:", e);
    return NextResponse.json({ error: "No se pudo cargar." }, { status: 500 });
  }
}
