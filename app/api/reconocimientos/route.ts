// FM RRHH — app/api/reconocimientos/route.ts
// El muro de reconocimientos visto por RR.HH.: todo lo publicado (también lo
// oculto), cómo se está usando, y los valores de la empresa.
//   POST sin accion         → RR.HH. reconoce a alguien en nombre de la empresa
//   POST accion "ocultar" / "mostrar" → saca o devuelve uno al muro
//   POST accion "valores"   → guarda la lista de valores
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { valoresDe, reconocer, limpiarValores, resumenReconocimientos, MAX_RECONOCIMIENTOS_POR_MES } from "@/lib/cultura";

export const dynamic = "force-dynamic";
const DIA_MS = 86400000;

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();
    const [valores, legajos, lista] = await Promise.all([
      valoresDe(empresa.id),
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
      prisma.reconocimiento.findMany({ where: { legajo: { empresaId: empresa.id } }, include: { legajo: { select: { apellido: true, nombre: true, centroCosto: { select: { nombre: true } } } }, _count: { select: { aplausos: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    ]);
    const ultimos90 = lista.filter((r) => r.createdAt.getTime() >= hoy.getTime() - 90 * DIA_MS);
    const nombre = new Map(legajos.map((l) => [l.id, `${l.nombre} ${l.apellido}`]));
    const res = resumenReconocimientos(ultimos90, legajos.length);
    return NextResponse.json({
      valores, tope: MAX_RECONOCIMIENTOS_POR_MES,
      legajos: legajos.map((l) => ({ id: l.id, nombre: `${l.apellido}, ${l.nombre}`, sector: l.centroCosto?.nombre ?? "Sin asignar" })),
      reconocimientos: lista.map((r) => ({ id: r.id, para: `${r.legajo.nombre} ${r.legajo.apellido}`, sector: r.legajo.centroCosto?.nombre ?? null, de: r.emisorNombre, deRRHH: !r.emisorId, valor: r.valor, emoji: r.emoji, mensaje: r.mensaje, oculto: r.oculto, aplausos: r._count.aplausos, createdAt: r.createdAt })),
      resumen: { ...res, masReconocidos: res.masReconocidos.map((x) => ({ ...x, nombre: nombre.get(x.clave) ?? "(ya no está)" })), masReconocen: res.masReconocen.map((x) => ({ ...x, nombre: nombre.get(x.clave) ?? "(ya no está)" })) },
    });
  } catch (e: any) {
    console.error("Error en GET /api/reconocimientos:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Reconocimientos. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar los reconocimientos. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    if (body.accion === "ocultar" || body.accion === "mostrar") {
      const ocultar = body.accion === "ocultar";
      const { count } = await prisma.reconocimiento.updateMany({ where: { id: String(body.id ?? ""), legajo: { empresaId: empresa.id } }, data: { oculto: ocultar, ocultoPor: ocultar ? sesion.email : null } });
      return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se encontró ese reconocimiento." }, { status: 404 });
    }
    if (body.accion === "valores") {
      const { valores, error } = limpiarValores(body.valores);
      if (error) return NextResponse.json({ error }, { status: 400 });
      // Se reemplaza la lista. Los reconocimientos ya dados guardan el
      // nombre del valor que tenían: no se rompen.
      await prisma.$transaction([prisma.valorEmpresa.deleteMany({ where: { empresaId: empresa.id } }), prisma.valorEmpresa.createMany({ data: valores.map((v, orden) => ({ empresaId: empresa.id, ...v, orden })) })]);
      return NextResponse.json({ ok: true });
    }
    const r = await reconocer(empresa.id, body, null, empresa.nombreFantasia || empresa.razonSocial, hoyArgentina());
    return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
  } catch (e: any) {
    console.error("Error en POST /api/reconocimientos:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
