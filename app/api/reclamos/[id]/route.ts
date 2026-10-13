// FM RRHH — app/api/reclamos/[id]/route.ts
// Lo que hace falta para resolver un reclamo: las líneas del recibo
// reclamado, el catálogo de conceptos y los períodos abiertos.
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { contextoReclamo } from "@/lib/reclamos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const c = await contextoReclamo(params.id, empresa.id);
    return c ? NextResponse.json(c) : NextResponse.json({ error: "No se encontró ese reclamo." }, { status: 404 });
  } catch (e) {
    console.error("Error en GET /api/reclamos/[id]:", e);
    return NextResponse.json({ error: "No se pudo cargar." }, { status: 500 });
  }
}
