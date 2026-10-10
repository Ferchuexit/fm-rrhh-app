// FM RRHH — app/api/capacitaciones/route.ts
// Capacitaciones de la empresa actual: listar y programar una nueva.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto, hoyArgentina } from "@/lib/ausencias-reglas";
import { validarCapacitacion } from "@/lib/capacitaciones-reglas";
import { avisar, avisoCapacitacionProgramada } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [capacitaciones, habilidades, legajos] = await Promise.all([
      prisma.capacitacion.findMany({ where: { empresaId: empresa.id }, include: { habilidad: { select: { nombre: true } } }, orderBy: { fecha: "desc" }, take: 200 }),
      prisma.habilidad.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true, grupo: true, vigenciaMeses: true }, orderBy: [{ grupo: "asc" }, { nombre: "asc" }] }),
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCostoId: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
    ]);
    // Asistentes aparte (no anidados): así quien está limitado a un sector
    // ve solo a su gente dentro de cada capacitación.
    const asistentes = await prisma.asistenteCapacitacion.findMany({
      where: { capacitacionId: { in: capacitaciones.map((c) => c.id) } },
      select: { id: true, capacitacionId: true, legajoId: true, asistio: true, firmadoEn: true, legajo: { select: { numeroLegajo: true, apellido: true, nombre: true } } },
      orderBy: { legajo: { apellido: "asc" } },
    });
    return NextResponse.json({
      hoy: hoyArgentina(),
      capacitaciones: capacitaciones.map((c) => ({ ...c, asistentes: asistentes.filter((a) => a.capacitacionId === c.id) })),
      habilidades,
      legajos: legajos.map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, centroCostoId: l.centroCostoId, sector: l.centroCosto?.nombre ?? "Sin asignar" })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/capacitaciones:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Capacitaciones. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar las capacitaciones. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const fecha = fechaDesdeTexto(body.fecha);
    const error = validarCapacitacion(body, fecha);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const legajoIds = [...new Set<string>(body.legajoIds.map(String))];
    const [legajos, habilidad] = await Promise.all([
      prisma.legajo.count({ where: { id: { in: legajoIds }, empresaId: empresa.id } }),
      body.habilidadId ? prisma.habilidad.findFirst({ where: { id: String(body.habilidadId), empresaId: empresa.id }, select: { id: true } }) : null,
    ]);
    if (legajos !== legajoIds.length) return NextResponse.json({ error: "Alguno de los asistentes no es de esta empresa o no lo tenés asignado. Recargá la página." }, { status: 400 });
    if (body.habilidadId && !habilidad) return NextResponse.json({ error: "Esa habilidad ya no existe. Recargá la página." }, { status: 400 });

    const txt = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;
    const capacitacion = await prisma.capacitacion.create({
      data: {
        empresaId: empresa.id, titulo: String(body.titulo).trim().slice(0, 120), descripcion: txt(body.descripcion, 1000), tipo: String(body.tipo), fecha: fecha!,
        horas: body.horas ? Number(body.horas) : null, instructor: txt(body.instructor, 80), lugar: txt(body.lugar, 80),
        habilidadId: habilidad?.id ?? null, nivelOtorgado: habilidad ? Number(body.nivelOtorgado) : null, creadaPor: sesion.email,
      },
    });
    await prisma.asistenteCapacitacion.createMany({ data: legajoIds.map((legajoId) => ({ capacitacionId: capacitacion.id, legajoId })) });
    // Si es a futuro, se les avisa. Una capacitación ya dada que se carga
    // después (para registrar) no avisa nada hasta que se cierra.
    if (fecha! >= hoyArgentina()) await avisar(legajoIds, avisoCapacitacionProgramada(capacitacion.titulo, fecha!));
    return NextResponse.json({ ok: true, id: capacitacion.id });
  } catch (e: any) {
    console.error("Error en POST /api/capacitaciones:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar la capacitación. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
