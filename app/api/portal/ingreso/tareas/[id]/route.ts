// Desde el portal: el empleado tilda una tarea SUYA de su propio ingreso, o
// el jefe tilda una tarea DE JEFE del ingreso de alguien que le reporta.
// Las que el sistema comprueba solo (con `clave`) no se tildan a mano acá.
import { NextResponse } from "next/server";
import { obtenerSesionPortal } from "@/lib/portal";
import { marcarTarea } from "@/lib/ingresos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const hecha = (await req.json().catch(() => ({})))?.hecha !== false;

    const propias = { responsable: "empleado", clave: null, ingreso: { estado: "en_curso", legajoId: sesion.legajoId } };
    const deMiEquipo = { responsable: "jefe", clave: null, ingreso: { estado: "en_curso", legajo: { jefeId: sesion.legajoId } } };
    const estado = hecha ? "hecha" : "pendiente";
    const ok = (await marcarTarea(params.id, estado, "empleado", null, propias)) || (await marcarTarea(params.id, estado, `jefe: ${sesion.nombre}`, null, deMiEquipo));
    if (!ok) return NextResponse.json({ error: "Esa tarea no es tuya, o el ingreso ya está cerrado." }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/ingreso/tareas/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
