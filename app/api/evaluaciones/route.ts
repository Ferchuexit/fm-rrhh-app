// FM RRHH — app/api/evaluaciones/route.ts
// Evaluación de desempeño: ciclos de la empresa actual y abrir uno nuevo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto, hoyArgentina } from "@/lib/ausencias-reglas";
import { formulariosDe, resumenCiclo, type Competencia } from "@/lib/evaluaciones";
import { avisar, avisoEvaluacionesParaCompletar, avisoAutoevaluacion } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [ciclos, formularios, legajos] = await Promise.all([
      prisma.cicloEvaluacion.findMany({ where: { empresaId: empresa.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      formulariosDe(empresa.id),
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCostoId: true, jefeId: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
    ]);
    // Aparte (no anidadas): así quien está limitado a un sector ve el
    // avance y los promedios solo de su gente.
    const evaluaciones = await prisma.evaluacion.findMany({ where: { cicloId: { in: ciclos.map((c) => c.id) } }, select: { cicloId: true, estado: true, puntajes: true, promedio: true } });
    return NextResponse.json({
      hoy: hoyArgentina(),
      ciclos: ciclos.map((c) => ({ id: c.id, nombre: c.nombre, formulario: c.formulario, fechaLimite: c.fechaLimite, estado: c.estado, conAutoevaluacion: c.conAutoevaluacion, resumen: resumenCiclo(c.competencias as unknown as Competencia[], evaluaciones.filter((e) => e.cicloId === c.id)) })),
      formularios,
      legajos: legajos.map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, centroCostoId: l.centroCostoId, sector: l.centroCosto?.nombre ?? "Sin asignar", conJefe: !!l.jefeId })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/evaluaciones:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Evaluación de desempeño. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar las evaluaciones. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const nombre = String(body.nombre ?? "").trim().slice(0, 80);
    if (nombre.length < 3) return NextResponse.json({ error: "Ponele un nombre al ciclo (por ejemplo: Evaluación anual 2026)." }, { status: 400 });
    const fechaLimite = fechaDesdeTexto(body.fechaLimite);
    if (!fechaLimite || fechaLimite < hoyArgentina()) return NextResponse.json({ error: "La fecha límite tiene que ser de hoy en adelante." }, { status: 400 });
    const legajoIds = [...new Set<string>((Array.isArray(body.legajoIds) ? body.legajoIds : []).map(String))];
    if (legajoIds.length === 0) return NextResponse.json({ error: "Elegí a quién se evalúa." }, { status: 400 });

    const [formulario, legajos] = await Promise.all([
      prisma.formularioEvaluacion.findFirst({ where: { id: String(body.formularioId ?? ""), empresaId: empresa.id } }),
      prisma.legajo.findMany({ where: { id: { in: legajoIds }, empresaId: empresa.id, condicion: "activo" }, select: { id: true, jefe: { select: { id: true, condicion: true } } } }),
    ]);
    if (!formulario) return NextResponse.json({ error: "Ese formulario ya no existe. Recargá la página." }, { status: 400 });
    if (legajos.length !== legajoIds.length) return NextResponse.json({ error: "Alguno de los elegidos no es de esta empresa o ya no está activo. Recargá la página." }, { status: 400 });

    // Las competencias se COPIAN al ciclo: si después se edita el
    // formulario, las evaluaciones ya abiertas no cambian a mitad de camino.
    const ciclo = await prisma.cicloEvaluacion.create({ data: { empresaId: empresa.id, nombre, formulario: formulario.nombre, competencias: formulario.competencias as any, fechaLimite, creadoPor: sesion.email, conAutoevaluacion: body.conAutoevaluacion === true } });
    // Evalúa el jefe directo de hoy. Sin jefe (o con jefe dado de baja),
    // queda para que la complete RR.HH. desde el panel.
    const filas = legajos.map((l) => ({ cicloId: ciclo.id, legajoId: l.id, evaluadorId: l.jefe?.condicion === "activo" ? l.jefe.id : null }));
    await prisma.evaluacion.createMany({ data: filas });

    // Un solo aviso por jefe, con cuántas le tocan.
    const porJefe = new Map<string, number>();
    for (const f of filas) if (f.evaluadorId) porJefe.set(f.evaluadorId, (porJefe.get(f.evaluadorId) ?? 0) + 1);
    for (const [jefeId, cantidad] of porJefe) await avisar([jefeId], avisoEvaluacionesParaCompletar(cantidad, fechaLimite));

    if (ciclo.conAutoevaluacion) await avisar(filas.map((f) => f.legajoId), avisoAutoevaluacion(fechaLimite));

    return NextResponse.json({ ok: true, id: ciclo.id, evaluaciones: filas.length, jefes: porJefe.size, sinJefe: filas.filter((f) => !f.evaluadorId).length });
  } catch (e: any) {
    console.error("Error en POST /api/evaluaciones:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo abrir el ciclo. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
