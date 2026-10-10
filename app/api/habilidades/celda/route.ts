// Cargar a mano una celda de la matriz: el nivel de una persona en una
// habilidad (nivel 0 = quitarla). Para lo que la persona ya sabía hacer
// antes de que existiera el sistema, o lo que aprendió en el puesto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto, hoyArgentina } from "@/lib/ausencias-reglas";
import { NIVELES, vencimientoDe } from "@/lib/capacitaciones-reglas";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const nivel = Number(body.nivel);
    if (nivel !== 0 && !(nivel in NIVELES)) return NextResponse.json({ error: "Nivel inválido." }, { status: 400 });

    const [legajo, habilidad] = await Promise.all([
      prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true } }),
      prisma.habilidad.findFirst({ where: { id: String(body.habilidadId ?? ""), empresaId: empresa.id } }),
    ]);
    if (!legajo || !habilidad) return NextResponse.json({ error: "No se encontró la persona o la habilidad en esta empresa." }, { status: 404 });

    const clave = { legajoId_habilidadId: { legajoId: legajo.id, habilidadId: habilidad.id } };
    if (nivel === 0) {
      await prisma.habilidadLegajo.deleteMany({ where: { legajoId: legajo.id, habilidadId: habilidad.id } });
      return NextResponse.json({ ok: true });
    }
    // "desde": cuándo se habilitó (o renovó). Sin fecha, hoy. De ahí sale el vencimiento.
    const desde = fechaDesdeTexto(body.desde) ?? hoyArgentina();
    if (desde > hoyArgentina()) return NextResponse.json({ error: "La fecha no puede ser futura." }, { status: 400 });
    const datos = { nivel, desde, vence: vencimientoDe(desde, habilidad.vigenciaMeses), origen: "manual", cargadoPor: sesion.email };
    await prisma.habilidadLegajo.upsert({ where: clave, create: { legajoId: legajo.id, habilidadId: habilidad.id, ...datos }, update: datos });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/habilidades/celda:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
