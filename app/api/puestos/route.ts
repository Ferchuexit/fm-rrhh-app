// FM RRHH — app/api/puestos/route.ts
// Puestos de la empresa actual: el perfil de cada uno, de quién depende y
// quién lo ocupa. De acá sale el organigrama.
//   POST sin `accion`        → crea o edita un puesto
//   POST accion "ocupantes"  → dice qué personas ocupan un puesto
//   POST accion "borrar"
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { limpiarRequisitos } from "@/lib/objetivos-reglas";
import { validarPuesto, armaCirculo } from "@/lib/reclutamiento-reglas";

export const dynamic = "force-dynamic";
const fallo = (e: any, donde: string) => {
  if (e?.code === "P2002") return NextResponse.json({ error: "Ya hay un puesto con ese nombre." }, { status: 409 });
  console.error(`Error en ${donde}:`, e);
  return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? "Los puestos de la empresa los define RR.HH." : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
};

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [puestos, legajos, sectores, habilidades, busquedas] = await Promise.all([
      prisma.puesto.findMany({ where: { empresaId: empresa.id }, orderBy: { nombre: "asc" } }),
      // Aparte y no anidados: quien está limitado a un sector ve solo a su gente.
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, puestoId: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
      prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
      prisma.habilidad.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true, grupo: true }, orderBy: [{ grupo: "asc" }, { nombre: "asc" }] }),
      prisma.busqueda.findMany({ where: { empresaId: empresa.id, estado: { in: ["abierta", "pausada", "borrador"] }, puestoId: { not: null } }, select: { id: true, puestoId: true, estado: true } }),
    ]);
    return NextResponse.json({
      puestos: puestos.map((p) => ({ ...p, busquedaId: busquedas.find((b) => b.puestoId === p.id)?.id ?? null })),
      legajos: legajos.map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, puestoId: l.puestoId, sector: l.centroCosto?.nombre ?? "Sin asignar" })),
      sectores, habilidades,
    });
  } catch (e: any) {
    console.error("Error en GET /api/puestos:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Puestos. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar los puestos. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const id = body.id ? String(body.id) : null;
    if (id && !(await prisma.puesto.findFirst({ where: { id, empresaId: empresa.id }, select: { id: true } }))) return NextResponse.json({ error: "Ese puesto ya no existe. Recargá la página." }, { status: 404 });

    if (body.accion === "borrar") {
      if (!id) return NextResponse.json({ error: "Falta el puesto." }, { status: 400 });
      // Los que dependían de este quedan sin superior y sus ocupantes sin
      // puesto (lo resuelve la base). Se avisa antes en la pantalla.
      await prisma.puesto.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (body.accion === "ocupantes") {
      if (!id) return NextResponse.json({ error: "Falta el puesto." }, { status: 400 });
      const legajoIds = [...new Set<string>((Array.isArray(body.legajoIds) ? body.legajoIds : []).map(String))];
      const validos = await prisma.legajo.count({ where: { id: { in: legajoIds }, empresaId: empresa.id } });
      if (validos !== legajoIds.length) return NextResponse.json({ error: "Alguna de las personas no es de esta empresa o no la tenés asignada. Recargá la página." }, { status: 400 });
      await prisma.$transaction([
        prisma.legajo.updateMany({ where: { empresaId: empresa.id, puestoId: id, id: { notIn: legajoIds } }, data: { puestoId: null } }),
        prisma.legajo.updateMany({ where: { empresaId: empresa.id, id: { in: legajoIds } }, data: { puestoId: id } }),
      ]);
      return NextResponse.json({ ok: true });
    }

    const { datos, error } = validarPuesto(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const [todos, sector, habilidades] = await Promise.all([
      prisma.puesto.findMany({ where: { empresaId: empresa.id }, select: { id: true, reportaAId: true } }),
      datos.centroCostoId ? prisma.centroCosto.findFirst({ where: { id: datos.centroCostoId, empresaId: empresa.id }, select: { id: true } }) : null,
      prisma.habilidad.findMany({ where: { empresaId: empresa.id }, select: { id: true } }),
    ]);
    if (datos.centroCostoId && !sector) return NextResponse.json({ error: "Ese sector ya no existe. Recargá la página." }, { status: 400 });
    if (datos.reportaAId) {
      if (!todos.some((p) => p.id === datos.reportaAId)) return NextResponse.json({ error: "El puesto del que depende ya no existe. Recargá la página." }, { status: 400 });
      if (armaCirculo(id, datos.reportaAId, new Map(todos.map((p) => [p.id, p.reportaAId])))) return NextResponse.json({ error: "Así quedaría un círculo: ese puesto depende (directa o indirectamente) de este mismo." }, { status: 400 });
    }
    const req2 = limpiarRequisitos(body.habilidades, new Set(habilidades.map((h) => h.id)));
    if (req2.error) return NextResponse.json({ error: req2.error }, { status: 400 });

    const data = { ...datos, habilidades: req2.requisitos as any };
    const puesto = id ? await prisma.puesto.update({ where: { id }, data }) : await prisma.puesto.create({ data: { empresaId: empresa.id, ...data } });
    return NextResponse.json({ ok: true, id: puesto.id });
  } catch (e) {
    return fallo(e, "POST /api/puestos");
  }
}
