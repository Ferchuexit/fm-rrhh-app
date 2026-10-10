// RR.HH. marca una tarea de un ingreso: hecha, no aplica, o la vuelve a
// dejar pendiente. Puede marcar cualquiera, sea de quien sea.
import { NextResponse } from "next/server";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { marcarTarea } from "@/lib/ingresos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    if (!["hecha", "no_aplica", "pendiente"].includes(body.estado)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    const nota = String(body.nota ?? "").trim().slice(0, 300) || null;
    const ok = await marcarTarea(params.id, body.estado, sesion.email, nota, { ingreso: { estado: "en_curso", legajo: { empresaId: empresa.id } } });
    if (!ok) return NextResponse.json({ error: "Esa tarea ya no se puede cambiar: el ingreso está cerrado o no es de esta empresa." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/onboarding/tareas/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
