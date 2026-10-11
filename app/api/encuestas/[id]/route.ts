// FM RRHH — app/api/encuestas/[id]/route.ts
// Una encuesta: sus resultados, y abrirla, cerrarla o borrarla.
//
// Dos reglas para cuidar el anonimato:
//   - los resultados se ven recién con la encuesta CERRADA (mirarlos
//     mientras entran las respuestas, una por una, permitiría saber qué
//     contestó cada uno);
//   - y solo si respondieron al menos MINIMO_ANONIMATO personas.
// Mientras está abierta se ve únicamente cuántos respondieron.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { cerrarVencidas, filtroDestinatarios, resultados, MINIMO_ANONIMATO, type Pregunta } from "@/lib/encuestas";
import { avisar, avisoEncuestaAbierta } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    await cerrarVencidas(hoyArgentina(), empresa.id);
    const encuesta = await prisma.encuesta.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!encuesta) return NextResponse.json({ error: "No se encontró esa encuesta." }, { status: 404 });

    // Participación por sector: cuántos respondieron de cuántos. Nunca
    // quiénes: de la tabla de participaciones solo sale la cuenta.
    const [destinatarios, participaron] = await Promise.all([
      prisma.legajo.groupBy({ by: ["centroCostoId"], where: filtroDestinatarios(encuesta), _count: true }),
      prisma.legajo.groupBy({ by: ["centroCostoId"], where: { ...filtroDestinatarios(encuesta), participacionesEncuesta: { some: { encuestaId: encuesta.id } } }, _count: true }),
    ]);
    const nombres = new Map((await prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true } })).map((c) => [c.id, c.nombre]));
    const participacion = destinatarios.map((d) => ({ sector: d.centroCostoId ? nombres.get(d.centroCostoId) ?? "Sin sector" : "Sin sector", total: d._count, respondieron: participaron.find((p) => p.centroCostoId === d.centroCostoId)?._count ?? 0 })).sort((a, b) => a.sector.localeCompare(b.sector));

    let res = null;
    if (encuesta.estado === "cerrada") {
      const respuestas = await prisma.respuestaEncuesta.findMany({ where: { encuestaId: encuesta.id }, select: { sector: true, respuestas: true } });
      res = resultados(encuesta.preguntas as unknown as Pregunta[], respuestas, encuesta.id);
    }
    return NextResponse.json({ encuesta, participacion, minimo: MINIMO_ANONIMATO, resultados: res });
  } catch (e) {
    console.error("Error en GET /api/encuestas/[id]:", e);
    return NextResponse.json({ error: "No se pudo cargar la encuesta. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { accion } = await req.json().catch(() => ({}));
    const encuesta = await prisma.encuesta.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!encuesta) return NextResponse.json({ error: "No se encontró esa encuesta." }, { status: 404 });

    if (accion === "abrir") {
      if (encuesta.fechaCierre < hoyArgentina()) return NextResponse.json({ error: "La fecha de cierre ya pasó: editá la encuesta y poné una nueva." }, { status: 400 });
      const destinatarios = await prisma.legajo.findMany({ where: filtroDestinatarios(encuesta), select: { id: true } });
      if (destinatarios.length < MINIMO_ANONIMATO) return NextResponse.json({ error: `Le llegaría a ${destinatarios.length} ${destinatarios.length === 1 ? "persona" : "personas"}. Con menos de ${MINIMO_ANONIMATO} no se puede garantizar el anonimato y no se mostrarían resultados: sumá sectores.` }, { status: 400 });
      const { count } = await prisma.encuesta.updateMany({ where: { id: encuesta.id, estado: "borrador" }, data: { estado: "abierta", abiertaEn: new Date() } });
      if (count === 0) return NextResponse.json({ error: "Esa encuesta ya estaba abierta." }, { status: 409 });
      await avisar(destinatarios.map((d) => d.id), avisoEncuestaAbierta(encuesta.fechaCierre));
      return NextResponse.json({ ok: true, destinatarios: destinatarios.length });
    }
    if (accion === "cerrar") {
      const { count } = await prisma.encuesta.updateMany({ where: { id: encuesta.id, estado: "abierta" }, data: { estado: "cerrada", cerradaEn: new Date() } });
      if (count === 0) return NextResponse.json({ error: "Esa encuesta no está abierta." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    if (accion === "borrar") {
      // Solo un borrador: una encuesta con respuestas es un registro.
      const { count } = await prisma.encuesta.deleteMany({ where: { id: encuesta.id, estado: "borrador" } });
      if (count === 0) return NextResponse.json({ error: "Solo se puede borrar una encuesta que todavía no se abrió." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (e: any) {
    console.error("Error en POST /api/encuestas/[id]:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo completar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
