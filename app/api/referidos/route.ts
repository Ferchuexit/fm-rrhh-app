// FM RRHH — app/api/referidos/route.ts
// El programa de referidos visto por RR.HH.: quién recomendó a quién, cómo
// le fue a cada recomendado, y qué premios falta entregar.
//   POST { id, entregado } → marca (o desmarca) el premio como entregado
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { resumenReferidos, RELACIONES } from "@/lib/referidos-reglas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [lista, abiertas] = await Promise.all([
      prisma.candidato.findMany({ where: { referidoPorId: { not: null }, busqueda: { empresaId: empresa.id } }, select: { id: true, nombre: true, apellido: true, etapa: true, etapaDesde: true, createdAt: true, referidoPorId: true, referidoPorNombre: true, relacionReferido: true, premioReferidoEn: true, busquedaId: true, busqueda: { select: { titulo: true, premioReferido: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.busqueda.findMany({ where: { empresaId: empresa.id, estado: "abierta" }, select: { id: true, titulo: true, referidos: true, premioReferido: true }, orderBy: { abiertaEn: "desc" } }),
    ]);
    const res = resumenReferidos(lista.map((c) => ({ referidoPorId: c.referidoPorId, etapa: c.etapa, premioReferidoEn: c.premioReferidoEn, conPremio: !!c.busqueda.premioReferido })));
    const nombre = new Map(lista.map((c) => [c.referidoPorId!, c.referidoPorNombre ?? "?"]));
    return NextResponse.json({
      abiertas,
      resumen: { ...res, quienes: res.quienes.slice(0, 10).map((q) => ({ ...q, nombre: nombre.get(q.clave) })) },
      referidos: lista.map((c) => ({ id: c.id, nombre: `${c.nombre} ${c.apellido}`, etapa: c.etapa, etapaDesde: c.etapaDesde, createdAt: c.createdAt, por: c.referidoPorNombre, relacion: RELACIONES[c.relacionReferido ?? ""] ?? null, busquedaId: c.busquedaId, busqueda: c.busqueda.titulo, premio: c.busqueda.premioReferido, premioEntregadoEn: c.premioReferidoEn })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/referidos:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Referidos. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar los referidos. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    // El premio se entrega por alguien que entró: no antes.
    const { count } = await prisma.candidato.updateMany({ where: { id: String(body.id ?? ""), referidoPorId: { not: null }, etapa: "contratado", busqueda: { empresaId: empresa.id } }, data: { premioReferidoEn: body.entregado === false ? null : new Date() } });
    return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se encontró ese referido, o todavía no ingresó." }, { status: 404 });
  } catch (e: any) {
    console.error("Error en POST /api/referidos:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
