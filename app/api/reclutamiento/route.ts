// FM RRHH — app/api/reclutamiento/route.ts
// Búsquedas de la empresa actual, con cuántos candidatos hay en cada etapa.
// POST crea una búsqueda o edita una existente.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { validarBusqueda, resumenBusqueda } from "@/lib/reclutamiento";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [busquedas, puestos] = await Promise.all([
      prisma.busqueda.findMany({ where: { empresaId: empresa.id }, include: { puesto: { select: { nombre: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.puesto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true, mision: true, tareas: true, requisitos: true, condiciones: true, centroCosto: { select: { nombre: true } } }, orderBy: { nombre: "asc" } }),
    ]);
    const candidatos = await prisma.candidato.findMany({ where: { busquedaId: { in: busquedas.map((b) => b.id) } }, select: { busquedaId: true, etapa: true, fuente: true } });
    const hoy = hoyArgentina();
    return NextResponse.json({
      empresa: empresa.nombreFantasia || empresa.razonSocial,
      busquedas: busquedas.map((b) => ({ ...b, resumen: resumenBusqueda(b, candidatos.filter((c) => c.busquedaId === b.id), hoy) })),
      puestos,
    });
  } catch (e: any) {
    console.error("Error en GET /api/reclutamiento:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Reclutamiento. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar las búsquedas. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const { datos, error } = validarBusqueda(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const puestoId = body.puestoId ? String(body.puestoId) : null;
    if (puestoId && !(await prisma.puesto.findFirst({ where: { id: puestoId, empresaId: empresa.id }, select: { id: true } }))) return NextResponse.json({ error: "Ese puesto ya no existe. Recargá la página." }, { status: 400 });

    if (body.id) {
      // Se puede corregir el aviso con la búsqueda abierta (un error de
      // tipeo, sumar una vacante); cerrada, ya es historia.
      const { count } = await prisma.busqueda.updateMany({ where: { id: String(body.id), empresaId: empresa.id, estado: { not: "cerrada" } }, data: { ...datos, puestoId } });
      if (count === 0) return NextResponse.json({ error: "Esa búsqueda está cerrada o no existe." }, { status: 409 });
      return NextResponse.json({ ok: true, id: body.id });
    }
    const creada = await prisma.busqueda.create({ data: { empresaId: empresa.id, puestoId, creadaPor: sesion.email, ...datos } });
    return NextResponse.json({ ok: true, id: creada.id });
  } catch (e: any) {
    console.error("Error en POST /api/reclutamiento:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? "Las búsquedas las abre RR.HH." : "No se pudo guardar la búsqueda. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
