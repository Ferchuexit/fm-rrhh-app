// Desde el portal: el jefe tilda una tarea DE JEFE del egreso de alguien
// que le reporta. Las que el sistema comprueba solo no se tildan a mano.
import { NextResponse } from "next/server";
import { obtenerSesionPortal } from "@/lib/portal";
import { marcarTareaEgreso } from "@/lib/egresos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const hecha = (await req.json().catch(() => ({})))?.hecha !== false;
    const ok = await marcarTareaEgreso(params.id, hecha ? "hecha" : "pendiente", `jefe: ${sesion.nombre}`, { responsable: "jefe", clave: null, egreso: { estado: "en_curso", legajo: { jefeId: sesion.legajoId } } });
    if (!ok) return NextResponse.json({ error: "Esa tarea no es tuya, o el egreso ya está cerrado." }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/egreso/tareas/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
