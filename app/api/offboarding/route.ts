// FM RRHH — app/api/offboarding/route.ts
// La pantalla de Offboarding de RR.HH.: egresos en curso, los cerrados
// hace poco, la rotación del último año, plantillas, y a quién se le
// podría iniciar uno.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto, hoyArgentina } from "@/lib/ausencias-reglas";
import { plantillasEgresoDe, iniciarEgreso, ponerAlDiaEgresos, progreso, etapaEgreso, validarInicio, resumenRotacion } from "@/lib/egresos";
import { avisar, avisoTareasDeEquipo } from "@/lib/avisos";

export const dynamic = "force-dynamic";
const DIA_MS = 24 * 3600 * 1000;

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();
    const deLaEmpresa = { legajo: { empresaId: empresa.id } };

    const enCurso = await prisma.egreso.findMany({ where: { ...deLaEmpresa, estado: "en_curso" }, select: { id: true } });
    await ponerAlDiaEgresos(enCurso.map((e) => e.id));

    const [egresos, delAnio, plantillas, legajos, activos] = await Promise.all([
      prisma.egreso.findMany({
        where: { ...deLaEmpresa, OR: [{ estado: "en_curso" }, { cerradoEn: { gte: new Date(hoy.getTime() - 90 * DIA_MS) } }] },
        include: {
          legajo: { select: { numeroLegajo: true, apellido: true, nombre: true, condicion: true, fechaIngreso: true, centroCosto: { select: { nombre: true } }, jefe: { select: { nombre: true, apellido: true } } } },
          tareas: { orderBy: [{ vence: "asc" }, { orden: "asc" }] },
        },
        orderBy: { fechaEgreso: "desc" },
      }),
      prisma.egreso.findMany({ where: { ...deLaEmpresa, fechaEgreso: { gte: new Date(hoy.getTime() - 365 * DIA_MS) } }, select: { estado: true, motivo: true, entrevistaMotivo: true, recontratable: true } }),
      plantillasEgresoDe(empresa.id),
      // A quién se le puede iniciar: los activos, y los dados de baja en
      // los últimos 60 días (para registrar una salida que ya pasó).
      prisma.legajo.findMany({
        where: { empresaId: empresa.id, OR: [{ condicion: { in: ["activo", "licencia"] } }, { fechaEgreso: { gte: new Date(hoy.getTime() - 60 * DIA_MS) } }], egresos: { none: { estado: { in: ["en_curso", "completado"] } } } },
        select: { id: true, numeroLegajo: true, apellido: true, nombre: true, condicion: true, fechaEgreso: true },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      }),
      prisma.legajo.count({ where: { empresaId: empresa.id, condicion: "activo" } }),
    ]);

    return NextResponse.json({
      hoy,
      egresos: egresos.map((e) => ({ ...e, progreso: progreso(e.tareas, hoy), tareas: e.tareas.map((t) => ({ ...t, etapa: etapaEgreso(e.fechaEgreso, t.vence), vencida: t.estado === "pendiente" && t.vence < hoy })) })),
      rotacion: { ...resumenRotacion(delAnio), dotacion: activos },
      plantillas,
      candidatos: legajos.map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, yaDeBaja: l.condicion !== "activo" && l.condicion !== "licencia", fechaEgreso: l.fechaEgreso })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/offboarding:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Offboarding. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudo cargar Offboarding. Probá de nuevo en un momento." }, { status: 500 });
  }
}

// Inicia el egreso de una persona a partir de una plantilla.
export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const fechaEgreso = fechaDesdeTexto(body.fechaEgreso);
    const error = validarInicio(body.motivo, fechaEgreso, hoyArgentina());
    if (error) return NextResponse.json({ error }, { status: 400 });
    const [legajo, plantilla] = await Promise.all([
      prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true, fechaIngreso: true, jefeId: true } }),
      prisma.plantillaEgreso.findFirst({ where: { id: String(body.plantillaId ?? ""), empresaId: empresa.id } }),
    ]);
    if (!legajo) return NextResponse.json({ error: "Elegí quién se va." }, { status: 400 });
    if (!plantilla) return NextResponse.json({ error: "Elegí una plantilla." }, { status: 400 });
    if (fechaEgreso! < legajo.fechaIngreso) return NextResponse.json({ error: "El último día no puede ser anterior a su fecha de ingreso." }, { status: 400 });
    if (await prisma.egreso.count({ where: { legajoId: legajo.id, estado: "en_curso" } })) return NextResponse.json({ error: "Esa persona ya tiene un egreso en curso." }, { status: 409 });

    const egreso = await iniciarEgreso(legajo.id, plantilla, fechaEgreso!, body.motivo, sesion.email);
    await ponerAlDiaEgresos([egreso.id]); // lo que ya estaba resuelto arranca tildado

    // Al jefe, solo si le tocó alguna tarea. A quien se va no se le avisa
    // nada: la salida se comunica en persona, no por una notificación.
    const paraElJefe = await prisma.tareaEgreso.count({ where: { egresoId: egreso.id, responsable: "jefe", estado: "pendiente" } });
    if (legajo.jefeId && paraElJefe > 0) await avisar([legajo.jefeId], avisoTareasDeEquipo());
    return NextResponse.json({ ok: true, id: egreso.id });
  } catch (e: any) {
    console.error("Error en POST /api/offboarding:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo iniciar el egreso. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
