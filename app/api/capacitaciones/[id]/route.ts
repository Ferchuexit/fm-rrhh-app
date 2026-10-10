// FM RRHH — app/api/capacitaciones/[id]/route.ts
// Lo que se hace con una capacitación programada:
//   asistencia → guardar quién vino (se puede ir guardando de a poco)
//   cerrar     → darla por realizada: quienes asistieron suben de nivel en
//                la matriz (si la capacitación habilita para algo) y
//                reciben el aviso para confirmar que la recibieron
//   cancelar   → no se hizo
import { NextResponse } from "next/server";
import { prisma, prismaSistema } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { trasCapacitar } from "@/lib/capacitaciones-reglas";
import { avisar, avisoConstanciaCapacitacion } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const cap = await prisma.capacitacion.findFirst({ where: { id: params.id, empresaId: empresa.id }, include: { habilidad: true } });
    if (!cap) return NextResponse.json({ error: "No se encontró esa capacitación." }, { status: 404 });
    if (cap.estado !== "programada") return NextResponse.json({ error: `Esa capacitación ya está ${cap.estado}.` }, { status: 409 });

    if (body.accion === "cancelar") {
      await prisma.capacitacion.updateMany({ where: { id: cap.id, estado: "programada" }, data: { estado: "cancelada", cerradaPor: sesion.email, cerradaEn: new Date() } });
      return NextResponse.json({ ok: true });
    }
    if (body.accion !== "asistencia" && body.accion !== "cerrar") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });

    // { legajoId: true | false } — solo se toca a quienes vienen en el pedido.
    const marcas = Object.entries((body.asistencia ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "boolean") as [string, boolean][];
    for (const valor of [true, false]) {
      const ids = marcas.filter(([, v]) => v === valor).map(([id]) => id);
      if (ids.length) await prisma.asistenteCapacitacion.updateMany({ where: { capacitacionId: cap.id, legajoId: { in: ids } }, data: { asistio: valor } });
    }
    if (body.accion === "asistencia") return NextResponse.json({ ok: true });

    // ── Cerrar ──
    // Cerrar vale para TODOS los asistentes, no solo para los que ve quien
    // la cierra (alguien limitado a un sector ve solo a su gente). Por eso
    // esta parte lee y escribe sin el filtro de alcance: la capacitación ya
    // se verificó arriba como de esta empresa, y si queda alguien de otro
    // sector sin marcar, no se cierra.
    const asistentes = await prismaSistema.asistenteCapacitacion.findMany({ where: { capacitacionId: cap.id }, select: { legajoId: true, asistio: true } });
    const sinMarcar = asistentes.filter((a) => a.asistio === null).length;
    if (sinMarcar > 0) return NextResponse.json({ error: `Falta marcar si ${sinMarcar === 1 ? "vino 1 persona" : `vinieron ${sinMarcar} personas`}. Tomá la asistencia completa antes de cerrar (si no los ves en la lista, son de otro sector: la cierra RR.HH.).` }, { status: 400 });
    const presentes = asistentes.filter((a) => a.asistio).map((a) => a.legajoId);
    if (presentes.length === 0) return NextResponse.json({ error: "No asistió nadie: en ese caso, cancelala." }, { status: 400 });

    const { count } = await prisma.capacitacion.updateMany({ where: { id: cap.id, estado: "programada" }, data: { estado: "realizada", cerradaPor: sesion.email, cerradaEn: new Date() } });
    if (count === 0) return NextResponse.json({ error: "Otra persona la acaba de cerrar." }, { status: 409 });

    if (cap.habilidad && cap.nivelOtorgado) {
      const actuales = await prismaSistema.habilidadLegajo.findMany({ where: { habilidadId: cap.habilidad.id, legajoId: { in: presentes } }, select: { legajoId: true, nivel: true } });
      for (const legajoId of presentes) {
        const nuevo = { ...trasCapacitar(actuales.find((a) => a.legajoId === legajoId) ?? null, cap.nivelOtorgado, cap.fecha, cap.habilidad.vigenciaMeses), origen: "capacitacion", cargadoPor: sesion.email };
        await prismaSistema.habilidadLegajo.upsert({ where: { legajoId_habilidadId: { legajoId, habilidadId: cap.habilidad.id } }, create: { legajoId, habilidadId: cap.habilidad.id, ...nuevo }, update: nuevo });
      }
    }
    await avisar(presentes, avisoConstanciaCapacitacion(cap.titulo));
    return NextResponse.json({ ok: true, presentes: presentes.length, habilitados: cap.habilidad ? presentes.length : 0 });
  } catch (e: any) {
    console.error("Error en POST /api/capacitaciones/[id]:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
