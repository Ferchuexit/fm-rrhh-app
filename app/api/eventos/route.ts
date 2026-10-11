// FM RRHH — app/api/eventos/route.ts
// Eventos de la empresa actual: listarlos con cuántos van, y crear o editar.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { avisar, avisoEventoCambio } from "@/lib/avisos";
import { filtroInvitados, validarEvento, resumenEvento, cuandoEs } from "@/lib/eventos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [eventos, sectores] = await Promise.all([
      prisma.evento.findMany({ where: { empresaId: empresa.id }, orderBy: [{ fecha: "desc" }, { hora: "desc" }], take: 80 }),
      prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    ]);
    const [respuestas, invitados] = await Promise.all([
      prisma.asistenciaEvento.findMany({ where: { eventoId: { in: eventos.map((e) => e.id) } }, select: { eventoId: true, va: true, acompanantes: true, asistio: true } }),
      Promise.all(eventos.map((e) => prisma.legajo.count({ where: filtroInvitados(e) }))),
    ]);
    return NextResponse.json({ hoy: hoyArgentina(), sectores, eventos: eventos.map((e, i) => ({ ...e, invitados: invitados[i], resumen: resumenEvento(respuestas.filter((r) => r.eventoId === e.id), invitados[i], e.cupo) })) });
  } catch (e: any) {
    console.error("Error en GET /api/eventos:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Eventos. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar los eventos. Probá de nuevo en un momento." }, { status: 500 });
  }
}

// Crea un borrador o edita un evento. Uno ya publicado se puede corregir
// (pasa: cambia la hora, se muda de lugar): si cambia el cuándo o el dónde,
// se les avisa a los invitados.
export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const { datos, error } = validarEvento(body, hoyArgentina());
    if (!datos) return NextResponse.json({ error }, { status: 400 });
    const validos = await prisma.centroCosto.count({ where: { id: { in: datos.centroCostoIds }, empresaId: empresa.id } });
    if (validos !== datos.centroCostoIds.length) return NextResponse.json({ error: "Alguno de los sectores ya no existe. Recargá la página." }, { status: 400 });

    if (!body.id) {
      const creado = await prisma.evento.create({ data: { ...datos, empresaId: empresa.id, creadoPor: sesion.email } });
      return NextResponse.json({ ok: true, id: creado.id });
    }
    const antes = await prisma.evento.findFirst({ where: { id: String(body.id), empresaId: empresa.id } });
    if (!antes) return NextResponse.json({ error: "No se encontró ese evento." }, { status: 404 });
    if (antes.estado === "cancelado") return NextResponse.json({ error: "Ese evento está cancelado: no se puede editar." }, { status: 409 });
    if (antes.estado === "publicado" && datos.cupo !== null) {
      // No se puede achicar el cupo por debajo de los que ya confirmaron.
      const van = await prisma.asistenciaEvento.findMany({ where: { eventoId: antes.id, va: true }, select: { acompanantes: true } });
      const ocupados = van.reduce((a, r) => a + 1 + r.acompanantes, 0);
      if (ocupados > datos.cupo) return NextResponse.json({ error: `Ya hay ${ocupados} lugares confirmados: el cupo no puede ser menor.` }, { status: 400 });
    }
    await prisma.evento.update({ where: { id: antes.id }, data: datos });
    const cambioCuando = antes.fecha.getTime() !== datos.fecha.getTime() || antes.hora !== datos.hora || antes.lugar !== datos.lugar;
    if (antes.estado === "publicado" && cambioCuando) {
      const invitados = await prisma.legajo.findMany({ where: filtroInvitados({ empresaId: empresa.id, centroCostoIds: datos.centroCostoIds }), select: { id: true } });
      await avisar(invitados.map((l) => l.id), avisoEventoCambio(datos.titulo, cuandoEs(datos)));
    }
    return NextResponse.json({ ok: true, id: antes.id });
  } catch (e: any) {
    console.error("Error en POST /api/eventos:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
