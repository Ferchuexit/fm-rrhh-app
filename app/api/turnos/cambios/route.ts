// FM RRHH — app/api/turnos/cambios/route.ts
// Cambio de UN día para UNA persona: ese día es franco, o trabaja en otro
// horario. tipo "quitar" lo borra y vuelve a valer su horario habitual.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto, hoyArgentina } from "@/lib/ausencias-reglas";
import { validarCambio } from "@/lib/turnos";
import { avisar, avisoCambioDeUnDia } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const fecha = fechaDesdeTexto(body.fecha);
    if (!fecha) return NextResponse.json({ error: "Elegí el día." }, { status: 400 });
    const legajo = await prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true } });
    if (!legajo) return NextResponse.json({ error: "Elegí a quién le cambia el horario." }, { status: 400 });

    if (body.tipo === "quitar") {
      await prisma.cambioDeTurno.deleteMany({ where: { legajoId: legajo.id, fecha } });
    } else {
      const error = validarCambio(body.tipo, body.ingreso, body.salida);
      if (error) return NextResponse.json({ error }, { status: 400 });
      const datos = { tipo: String(body.tipo), ingreso: body.tipo === "horario" ? String(body.ingreso) : null, salida: body.tipo === "horario" ? String(body.salida) : null, motivo: String(body.motivo ?? "").trim().slice(0, 200) || null, cargadoPor: sesion.email };
      await prisma.cambioDeTurno.upsert({ where: { legajoId_fecha: { legajoId: legajo.id, fecha } }, create: { legajoId: legajo.id, fecha, ...datos }, update: datos });
    }
    if (fecha >= hoyArgentina()) await avisar([legajo.id], avisoCambioDeUnDia(fecha));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/turnos/cambios:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar el cambio. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
