// FM RRHH — app/api/agenda/route.ts
// La agenda de un mes de la empresa actual (?mes=2026-10).
//   POST → agrega una fecha a la agenda (una entrega, una auditoría, una
//          reunión). Se guarda como un evento ya publicado y sin pedido de
//          confirmación: lo ven todos los que corresponde, en el panel y
//          en el portal, y el día anterior se les recuerda solo.
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { agendaEmpresa, rangoDelMes, grillaDelMes } from "@/lib/agenda";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { avisar, avisoEventoNuevo } from "@/lib/avisos";
import { validarEvento, filtroInvitados, cuandoEs, CATEGORIAS_EVENTO } from "@/lib/eventos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();
    const { desde, hasta, mes } = rangoDelMes(new URL(req.url).searchParams.get("mes"), hoy);
    // Se trae la grilla completa: los días de otros meses que completan las
    // semanas también muestran lo suyo.
    const semanas = grillaDelMes(desde, hasta);
    const items = await agendaEmpresa(empresa.id, semanas[0][0], semanas[semanas.length - 1][6]);
    const sectores = await prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
    return NextResponse.json({ mes, hoy, items, sectores });
  } catch (e) {
    console.error("Error en GET /api/agenda:", e);
    return NextResponse.json({ error: "No se pudo cargar la agenda. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const { datos, error } = validarEvento({ ...body, categoria: body.categoria in CATEGORIAS_EVENTO ? body.categoria : "otro", pideConfirmacion: false }, hoyArgentina());
    if (!datos) return NextResponse.json({ error }, { status: 400 });
    const validos = await prisma.centroCosto.count({ where: { id: { in: datos.centroCostoIds }, empresaId: empresa.id } });
    if (validos !== datos.centroCostoIds.length) return NextResponse.json({ error: "Alguno de los sectores ya no existe. Recargá la página." }, { status: 400 });
    const e = await prisma.evento.create({ data: { ...datos, empresaId: empresa.id, creadoPor: sesion.email, estado: "publicado", publicadoEn: new Date() } });
    let avisados = 0;
    if (body.avisar === true) {
      const gente = await prisma.legajo.findMany({ where: filtroInvitados(e), select: { id: true } });
      avisados = (await avisar(gente.map((l) => l.id), { ...avisoEventoNuevo(datos.titulo, cuandoEs(datos), false), titulo: `${CATEGORIAS_EVENTO[datos.categoria].nombre}: ${datos.titulo.slice(0, 60)}`, url: "/portal/agenda" })).personas;
    }
    return NextResponse.json({ ok: true, id: e.id, avisados });
  } catch (e: any) {
    console.error("Error en POST /api/agenda:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? "Las fechas de toda la empresa las carga RR.HH." : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
