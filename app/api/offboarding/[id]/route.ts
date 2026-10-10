// FM RRHH — app/api/offboarding/[id]/route.ts
// Sobre UN egreso:
//   entrevista → guarda la entrevista de salida (se puede corregir).
//   cancelar   → se cargó por error o la persona al final se queda. No se
//                borra: queda cancelado y no cuenta en la rotación.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { validarEntrevista, ponerAlDiaEgresos } from "@/lib/egresos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const egreso = await prisma.egreso.findFirst({ where: { id: params.id, legajo: { empresaId: empresa.id } }, select: { id: true, estado: true } });
    if (!egreso) return NextResponse.json({ error: "No se encontró ese egreso." }, { status: 404 });

    if (body.accion === "cancelar") {
      const { count } = await prisma.egreso.updateMany({ where: { id: egreso.id, estado: "en_curso" }, data: { estado: "cancelado", cerradoEn: new Date() } });
      if (count === 0) return NextResponse.json({ error: "Ese egreso ya estaba cerrado." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    if (body.accion !== "entrevista") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    if (egreso.estado === "cancelado") return NextResponse.json({ error: "Ese egreso está cancelado." }, { status: 409 });
    const { datos, error } = validarEntrevista(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    await prisma.egreso.update({ where: { id: egreso.id }, data: { ...datos, entrevistaPor: sesion.email, entrevistaEn: new Date() } });
    await ponerAlDiaEgresos([egreso.id]); // tilda la tarea "Entrevista de salida"
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/offboarding/[id]:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
