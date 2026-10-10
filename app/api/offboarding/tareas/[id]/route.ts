// RR.HH. marca una tarea de un egreso: hecha, no aplica, o la vuelve a
// dejar pendiente. Puede marcar cualquiera, sea de quien sea.
import { NextResponse } from "next/server";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { marcarTareaEgreso } from "@/lib/egresos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    if (!["hecha", "no_aplica", "pendiente"].includes(body.estado)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    const ok = await marcarTareaEgreso(params.id, body.estado, sesion.email, { egreso: { estado: "en_curso", legajo: { empresaId: empresa.id } } });
    if (!ok) return NextResponse.json({ error: "Esa tarea ya no se puede cambiar: el egreso está cerrado o no es de esta empresa." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/offboarding/tareas/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
