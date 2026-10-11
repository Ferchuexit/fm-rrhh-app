// FM RRHH — app/api/encuestas/route.ts
// Encuestas de clima de la empresa actual: listarlas con su participación,
// y crear o editar un borrador.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto, hoyArgentina } from "@/lib/ausencias-reglas";
import { cerrarVencidas, filtroDestinatarios, limpiarPreguntas, type Pregunta } from "@/lib/encuestas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();
    await cerrarVencidas(hoy, empresa.id);
    const [encuestas, sectores] = await Promise.all([
      prisma.encuesta.findMany({ where: { empresaId: empresa.id }, orderBy: { createdAt: "desc" }, take: 60, include: { _count: { select: { respuestas: true } } } }),
      prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    ]);
    // A cuántos les corresponde cada una (hoy): para el % de participación.
    const destinatarios = await Promise.all(encuestas.map((e) => prisma.legajo.count({ where: filtroDestinatarios(e) })));
    return NextResponse.json({
      hoy, sectores,
      encuestas: encuestas.map((e, i) => ({ id: e.id, titulo: e.titulo, descripcion: e.descripcion, preguntas: e.preguntas, centroCostoIds: e.centroCostoIds, estado: e.estado, fechaCierre: e.fechaCierre, respuestas: e._count.respuestas, destinatarios: destinatarios[i] })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/encuestas:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Encuestas. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar las encuestas. Probá de nuevo en un momento." }, { status: 500 });
  }
}

// Crea un borrador o edita uno. Una encuesta ya abierta no se edita: los
// que respondieron contestaron ESAS preguntas.
export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const titulo = String(body.titulo ?? "").trim().slice(0, 100);
    if (titulo.length < 3) return NextResponse.json({ error: "Ponele un título a la encuesta." }, { status: 400 });
    const fechaCierre = fechaDesdeTexto(body.fechaCierre);
    if (!fechaCierre || fechaCierre < hoyArgentina()) return NextResponse.json({ error: "Elegí hasta qué día se puede responder (de hoy en adelante)." }, { status: 400 });
    const { preguntas, error } = limpiarPreguntas(body.preguntas);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const pedidos = [...new Set<string>((Array.isArray(body.centroCostoIds) ? body.centroCostoIds : []).map(String))];
    const centroCostoIds = (await prisma.centroCosto.findMany({ where: { id: { in: pedidos }, empresaId: empresa.id }, select: { id: true } })).map((c) => c.id);
    if (centroCostoIds.length !== pedidos.length) return NextResponse.json({ error: "Alguno de los sectores ya no existe. Recargá la página." }, { status: 400 });

    const data = { titulo, descripcion: String(body.descripcion ?? "").trim().slice(0, 500) || null, preguntas: preguntas as unknown as Pregunta[] as any, centroCostoIds, fechaCierre };
    if (body.id) {
      const { count } = await prisma.encuesta.updateMany({ where: { id: String(body.id), empresaId: empresa.id, estado: "borrador" }, data });
      if (count === 0) return NextResponse.json({ error: "Esa encuesta ya se abrió (o no existe): no se puede editar." }, { status: 409 });
      return NextResponse.json({ ok: true, id: body.id });
    }
    const creada = await prisma.encuesta.create({ data: { empresaId: empresa.id, creadaPor: sesion.email, ...data } });
    return NextResponse.json({ ok: true, id: creada.id });
  } catch (e: any) {
    console.error("Error en POST /api/encuestas:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar la encuesta. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
