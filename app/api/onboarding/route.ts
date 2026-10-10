// FM RRHH — app/api/onboarding/route.ts
// La pantalla de Onboarding de RR.HH.: ingresos en curso, plantillas, y a
// quién se le podría iniciar uno.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { plantillasDeEmpresa, iniciarIngreso, ponerAlDia, progreso, etapaDe } from "@/lib/ingresos";
import { avisar, avisoIngresoAlEmpleado, avisoIngresoAlJefe } from "@/lib/avisos";

export const dynamic = "force-dynamic";
const DIA_MS = 24 * 3600 * 1000;

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();

    const enCurso = await prisma.ingreso.findMany({ where: { legajo: { empresaId: empresa.id }, estado: "en_curso" }, select: { id: true } });
    await ponerAlDia(enCurso.map((i) => i.id));

    const [ingresos, plantillas, legajos] = await Promise.all([
      prisma.ingreso.findMany({
        where: { legajo: { empresaId: empresa.id }, OR: [{ estado: "en_curso" }, { cerradoEn: { gte: new Date(hoy.getTime() - 60 * DIA_MS) } }] },
        include: {
          legajo: { select: { numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } }, jefe: { select: { nombre: true, apellido: true } } } },
          tareas: { orderBy: [{ vence: "asc" }, { orden: "asc" }] },
        },
        orderBy: { fechaIngreso: "desc" },
      }),
      plantillasDeEmpresa(empresa.id),
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, fechaIngreso: true, ingresos: { select: { id: true } } }, orderBy: { fechaIngreso: "desc" } }),
    ]);

    return NextResponse.json({
      hoy,
      ingresos: ingresos.map((i) => ({ ...i, progreso: progreso(i.tareas, hoy), tareas: i.tareas.map((t) => ({ ...t, etapa: etapaDe(i.fechaIngreso, t.vence), vencida: t.estado === "pendiente" && t.vence < hoy })) })),
      plantillas,
      // Quien nunca tuvo un plan de ingreso; arriba, los que entraron hace
      // poco o todavía no entraron.
      sinPlan: legajos.filter((l) => l.ingresos.length === 0).map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, fechaIngreso: l.fechaIngreso, reciente: l.fechaIngreso.getTime() >= hoy.getTime() - 45 * DIA_MS })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/onboarding:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Onboarding. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudo cargar Onboarding. Probá de nuevo en un momento." }, { status: 500 });
  }
}

// Inicia el ingreso de una persona a partir de una plantilla.
export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const [legajo, plantilla] = await Promise.all([
      prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true, nombre: true, apellido: true, fechaIngreso: true, jefeId: true } }),
      prisma.plantillaIngreso.findFirst({ where: { id: String(body.plantillaId ?? ""), empresaId: empresa.id } }),
    ]);
    if (!legajo) return NextResponse.json({ error: "Elegí a quién se le inicia el ingreso." }, { status: 400 });
    if (!plantilla) return NextResponse.json({ error: "Elegí una plantilla." }, { status: 400 });
    if (await prisma.ingreso.count({ where: { legajoId: legajo.id, estado: "en_curso" } })) return NextResponse.json({ error: "Esa persona ya tiene un ingreso en curso." }, { status: 409 });

    const ingreso = await iniciarIngreso(legajo.id, plantilla, sesion.email);
    await ponerAlDia([ingreso.id]); // lo que ya estaba hecho arranca tildado

    await avisar([legajo.id], avisoIngresoAlEmpleado());
    if (legajo.jefeId) await avisar([legajo.jefeId], avisoIngresoAlJefe(`${legajo.nombre} ${legajo.apellido}`, legajo.fechaIngreso));
    return NextResponse.json({ ok: true, id: ingreso.id });
  } catch (e: any) {
    console.error("Error en POST /api/onboarding:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo iniciar el ingreso. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
