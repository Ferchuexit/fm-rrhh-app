// FM RRHH — app/api/habilidades/route.ts
// La matriz de habilidades de la empresa actual: qué habilidades hay, qué
// nivel tiene cada persona en cada una, cuánta gente cubre cada puesto y
// qué está vencido o por vencer.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { cobertura, estadoHabilidad, validarHabilidad } from "@/lib/capacitaciones-reglas";

export const dynamic = "force-dynamic";
const fallo = (e: any, accion: string) => (e?.name === "FueraDeAlcance" ? NextResponse.json({ error: "Las habilidades de la empresa las define RR.HH. Vos podés cargar el nivel de tu gente." }, { status: 403 }) : NextResponse.json({ error: `No se pudo ${accion}. Probá de nuevo en un momento.` }, { status: 500 }));

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();
    const [habilidades, legajos, celdas] = await Promise.all([
      prisma.habilidad.findMany({ where: { empresaId: empresa.id }, orderBy: [{ grupo: "asc" }, { nombre: "asc" }] }),
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCostoId: true, centroCosto: { select: { nombre: true } } }, orderBy: { numeroLegajo: "asc" } }),
      // Las celdas se piden aparte (y no anidadas en la habilidad) para que
      // quien está limitado a un sector reciba solo las de su gente.
      prisma.habilidadLegajo.findMany({ where: { legajo: { empresaId: empresa.id, condicion: "activo" } }, select: { legajoId: true, habilidadId: true, nivel: true, desde: true, vence: true, origen: true } }),
    ]);
    return NextResponse.json({
      hoy,
      habilidades: habilidades.map((h) => ({ ...h, cobertura: cobertura(celdas.filter((c) => c.habilidadId === h.id), hoy) })),
      legajos: legajos.map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, centroCostoId: l.centroCostoId, sector: l.centroCosto?.nombre ?? "Sin asignar" })),
      celdas: celdas.map((c) => ({ ...c, estado: estadoHabilidad(c.vence, hoy) })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/habilidades:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Habilidades. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudo cargar la matriz. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const { datos, error } = validarHabilidad(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (body.id) {
      const { count } = await prisma.habilidad.updateMany({ where: { id: String(body.id), empresaId: empresa.id }, data: datos });
      if (count === 0) return NextResponse.json({ error: "Esa habilidad ya no existe." }, { status: 404 });
      return NextResponse.json({ ok: true, id: body.id });
    }
    const creada = await prisma.habilidad.create({ data: { empresaId: empresa.id, ...datos } });
    return NextResponse.json({ ok: true, id: creada.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya hay una habilidad con ese nombre." }, { status: 409 });
    console.error("Error en POST /api/habilidades:", e);
    return fallo(e, "guardar la habilidad");
  }
}

export async function DELETE(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const id = new URL(req.url).searchParams.get("id") ?? "";
    // Con gente cargada no se borra: se perdería el registro de quién
    // estaba habilitado y desde cuándo.
    const personas = await prisma.habilidadLegajo.count({ where: { habilidadId: id, habilidad: { empresaId: empresa.id } } });
    if (personas > 0) return NextResponse.json({ error: `Hay ${personas} ${personas === 1 ? "persona cargada" : "personas cargadas"} en esta habilidad. Quitales el nivel primero, o cambiale el nombre si quedó en desuso.` }, { status: 409 });
    const { count } = await prisma.habilidad.deleteMany({ where: { id, empresaId: empresa.id } });
    if (count === 0) return NextResponse.json({ error: "Esa habilidad ya no existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/habilidades:", e);
    return fallo(e, "borrar la habilidad");
  }
}
