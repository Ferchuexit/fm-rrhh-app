// FM RRHH — app/api/objetivos/route.ts
// Objetivos y plan de carrera de la empresa actual: todo lo que necesita
// la pantalla, y cargar un objetivo (para una o varias personas).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { crearObjetivos } from "@/lib/objetivos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [legajos, habilidades] = await Promise.all([
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCostoId: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
      prisma.habilidad.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true, grupo: true }, orderBy: [{ grupo: "asc" }, { nombre: "asc" }] }),
    ]);
    const ids = legajos.map((l) => l.id);
    // Todo por legajo y aparte: respeta el límite por sector.
    const [objetivos, planes, tiene] = await Promise.all([
      prisma.objetivo.findMany({ where: { legajoId: { in: ids } }, orderBy: [{ fechaLimite: "asc" }], take: 2000 }),
      prisma.planCarrera.findMany({ where: { legajoId: { in: ids } } }),
      prisma.habilidadLegajo.findMany({ where: { legajoId: { in: ids } }, select: { legajoId: true, habilidadId: true, nivel: true, vence: true } }),
    ]);
    return NextResponse.json({
      hoy: hoyArgentina(), objetivos, planes, tiene, habilidades,
      legajos: legajos.map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, centroCostoId: l.centroCostoId, sector: l.centroCosto?.nombre ?? "Sin asignar" })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/objetivos:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Objetivos. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar los objetivos. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const legajoIds = [...new Set<string>((Array.isArray(body.legajoIds) ? body.legajoIds : []).map(String))];
    const validos = await prisma.legajo.count({ where: { id: { in: legajoIds }, empresaId: empresa.id, condicion: "activo" } });
    if (validos !== legajoIds.length) return NextResponse.json({ error: "Alguno de los elegidos no es de esta empresa, no lo tenés asignado o ya no está activo. Recargá la página." }, { status: 400 });
    const r = await crearObjetivos(legajoIds, body, sesion.email);
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e: any) {
    console.error("Error en POST /api/objetivos:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar el objetivo. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
