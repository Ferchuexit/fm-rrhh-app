// FM RRHH — app/api/banco-horas/acuerdo/[id]/route.ts
// El acuerdo de banco de horas en PDF, para imprimir y firmar.
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { pdfDeAcuerdo } from "@/lib/banco-horas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const r = await pdfDeAcuerdo(params.id, { empresaId: empresa.id });
    if (!r) return NextResponse.json({ error: "No se encontró ese acuerdo." }, { status: 404 });
    return new NextResponse(new Uint8Array(r.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.nombre}"` } });
  } catch (e) {
    console.error("Error en GET /api/banco-horas/acuerdo/[id]:", e);
    return NextResponse.json({ error: "No se pudo generar el acuerdo." }, { status: 500 });
  }
}
