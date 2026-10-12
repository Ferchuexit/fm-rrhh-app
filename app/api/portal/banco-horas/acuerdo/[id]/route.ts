// FM RRHH — app/api/portal/banco-horas/acuerdo/[id]/route.ts
// El empleado ve su propio acuerdo de banco de horas en PDF.
import { NextResponse } from "next/server";
import { obtenerSesionPortal } from "@/lib/portal";
import { pdfDeAcuerdo } from "@/lib/banco-horas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const r = await pdfDeAcuerdo(params.id, { legajoId: sesion.legajoId });
    if (!r) return NextResponse.json({ error: "No se encontró ese acuerdo." }, { status: 404 });
    return new NextResponse(new Uint8Array(r.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.nombre}"` } });
  } catch (e) {
    console.error("Error en GET /api/portal/banco-horas/acuerdo/[id]:", e);
    return NextResponse.json({ error: "No se pudo generar el acuerdo." }, { status: 500 });
  }
}
