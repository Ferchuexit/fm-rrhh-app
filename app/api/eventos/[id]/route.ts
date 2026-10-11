// FM RRHH — app/api/eventos/[id]/route.ts
// Un evento: quién va, quién no y quién no respondió.
//   POST accion "publicar"   → lo ven los invitados y se les avisa
//   POST accion "cancelar"   → se avisa a los invitados
//   POST accion "asistencia" → RR.HH. marca quién fue (después del evento)
//   POST accion "responder"  → RR.HH. anota a alguien que avisó de palabra
//   DELETE                   → borra un borrador
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { avisar, avisoEventoNuevo, avisoEventoCancelado } from "@/lib/avisos";
import { filtroInvitados, resumenEvento, cuandoEs, MAX_ACOMPANANTES } from "@/lib/eventos";

export const dynamic = "force-dynamic";
const falla = (e: any, donde: string) => {
  console.error(`Error en ${donde} /api/eventos/[id]:`, e);
  return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo completar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const evento = await prisma.evento.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!evento) return NextResponse.json({ error: "No se encontró ese evento." }, { status: 404 });
    const [invitados, respuestas] = await Promise.all([
      prisma.legajo.findMany({ where: filtroInvitados(evento), select: { id: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
      prisma.asistenciaEvento.findMany({ where: { eventoId: evento.id } }),
    ]);
    const por = new Map(respuestas.map((r) => [r.legajoId, r]));
    const deInvitados = respuestas.filter((r) => invitados.some((l) => l.id === r.legajoId));
    return NextResponse.json({
      resumen: resumenEvento(deInvitados, invitados.length, evento.cupo),
      personas: invitados.map((l) => { const r = por.get(l.id); return { id: l.id, nombre: `${l.apellido}, ${l.nombre}`, sector: l.centroCosto?.nombre ?? "Sin asignar", va: r?.va ?? null, acompanantes: r?.acompanantes ?? 0, asistio: r?.asistio ?? null }; }),
    });
  } catch (e) { return falla(e, "GET"); }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const evento = await prisma.evento.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!evento) return NextResponse.json({ error: "No se encontró ese evento." }, { status: 404 });
    const invitados = () => prisma.legajo.findMany({ where: filtroInvitados(evento), select: { id: true } });

    if (body.accion === "publicar") {
      if (evento.fecha < hoyArgentina()) return NextResponse.json({ error: "La fecha del evento ya pasó. Corregila antes de publicarlo." }, { status: 400 });
      const { count } = await prisma.evento.updateMany({ where: { id: evento.id, estado: "borrador" }, data: { estado: "publicado", publicadoEn: new Date() } });
      if (!count) return NextResponse.json({ error: "Ese evento ya estaba publicado." }, { status: 409 });
      const r = await avisar((await invitados()).map((l) => l.id), avisoEventoNuevo(evento.titulo, cuandoEs(evento), evento.pideConfirmacion));
      return NextResponse.json({ ok: true, avisados: r.personas });
    }
    if (body.accion === "cancelar") {
      const { count } = await prisma.evento.updateMany({ where: { id: evento.id, estado: "publicado" }, data: { estado: "cancelado" } });
      if (!count) return NextResponse.json({ error: "Solo se cancela un evento publicado." }, { status: 409 });
      // Si ya pasó no se molesta a nadie.
      if (evento.fecha >= hoyArgentina()) await avisar((await invitados()).map((l) => l.id), avisoEventoCancelado(evento.titulo));
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "asistencia" || body.accion === "responder") {
      if (evento.estado !== "publicado") return NextResponse.json({ error: "El evento no está publicado." }, { status: 409 });
      const legajo = await prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true } });
      if (!legajo) return NextResponse.json({ error: "No se encontró esa persona." }, { status: 404 });
      const clave = { eventoId_legajoId: { eventoId: evento.id, legajoId: legajo.id } };
      if (body.accion === "asistencia") {
        if (evento.fecha > hoyArgentina()) return NextResponse.json({ error: "La asistencia se toma el día del evento o después." }, { status: 400 });
        const asistio = body.asistio === null ? null : body.asistio === true;
        // Quien fue sin haber confirmado queda anotado como que fue.
        await prisma.asistenciaEvento.upsert({ where: clave, create: { eventoId: evento.id, legajoId: legajo.id, va: asistio === true, asistio }, update: { asistio } });
        return NextResponse.json({ ok: true });
      }
      // RR.HH. anota la respuesta de alguien (sin las trabas de fecha ni de
      // cupo: es quien organiza). null = borrar la respuesta.
      if (body.va === null) { await prisma.asistenciaEvento.deleteMany({ where: { eventoId: evento.id, legajoId: legajo.id } }); return NextResponse.json({ ok: true }); }
      const acompanantes = body.va === true ? Math.min(MAX_ACOMPANANTES, Math.max(0, Math.trunc(Number(body.acompanantes) || 0))) : 0;
      await prisma.asistenciaEvento.upsert({ where: clave, create: { eventoId: evento.id, legajoId: legajo.id, va: body.va === true, acompanantes }, update: { va: body.va === true, acompanantes } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) { return falla(e, "POST"); }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { count } = await prisma.evento.deleteMany({ where: { id: params.id, empresaId: empresa.id, estado: "borrador" } });
    return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Solo se borra un borrador. Uno publicado se cancela, así la gente se entera." }, { status: 409 });
  } catch (e) { return falla(e, "DELETE"); }
}
