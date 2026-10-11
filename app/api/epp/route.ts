// FM RRHH — app/api/epp/route.ts
// EPP y ropa de trabajo de la empresa actual.
//   GET → el catálogo, y persona por persona qué le corresponde y cómo está
//   POST accion "elemento"  → crea o edita un elemento del catálogo
//   POST accion "sugeridos" → agrega los elementos típicos que falten
//   POST accion "entregar"  → registra una entrega a una persona
//   POST accion "enPapel"   → marca que firmó la planilla impresa
//   POST accion "anular"    → borra una entrega cargada por error (sin firma)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { avisar } from "@/lib/avisos";
import { estadoEpp, registrarEntregas, validarElemento, ELEMENTOS_SUGERIDOS } from "@/lib/epp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();
    const [estado, sectores, puestos] = await Promise.all([
      estadoEpp(empresa.id, hoy),
      prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
      prisma.puesto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    ]);
    return NextResponse.json({ hoy, sectores, puestos, sugeridos: ELEMENTOS_SUGERIDOS.filter((s) => !estado.elementos.some((e) => e.nombre.toLowerCase() === s.nombre.toLowerCase())).length, ...estado });
  } catch (e: any) {
    console.error("Error en GET /api/epp:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para EPP. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudo cargar el EPP. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    if (body.accion === "entregar") {
      const r = await registrarEntregas(empresa.id, String(body.legajoId ?? ""), body.items, body.fecha, sesion.email, hoyArgentina());
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
      // Sin detalle de qué se entregó: se lee con el celular bloqueado.
      await avisar([String(body.legajoId)], { tipo: "epp", titulo: "Te entregaron elementos de trabajo", cuerpo: "Entrá al portal y confirmá que los recibiste. Es un toque.", url: "/portal/epp" });
      return NextResponse.json(r);
    }
    if (body.accion === "enPapel" || body.accion === "anular") {
      // La entrega es de una persona: el alcance ya limita a la gente propia.
      const e = await prisma.entregaEpp.findFirst({ where: { id: String(body.id ?? ""), legajo: { empresaId: empresa.id } }, select: { id: true, firmadoEn: true, enPapel: true } });
      if (!e) return NextResponse.json({ error: "No se encontró esa entrega." }, { status: 404 });
      if (body.accion === "enPapel") { await prisma.entregaEpp.update({ where: { id: e.id }, data: { enPapel: body.valor !== false } }); return NextResponse.json({ ok: true }); }
      if (e.firmadoEn) return NextResponse.json({ error: "Esa entrega ya la confirmó el empleado: es una constancia y no se borra." }, { status: 409 });
      await prisma.entregaEpp.delete({ where: { id: e.id } });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "sugeridos") {
      const hay = (await prisma.elementoEpp.findMany({ where: { empresaId: empresa.id }, select: { nombre: true } })).map((e) => e.nombre.toLowerCase());
      const nuevos = ELEMENTOS_SUGERIDOS.filter((s) => !hay.includes(s.nombre.toLowerCase()));
      // Entran sin nadie asignado: que le corresponda a alguien lo decide la empresa.
      if (nuevos.length) await prisma.elementoEpp.createMany({ data: nuevos.map((s) => ({ empresaId: empresa.id, nombre: s.nombre, tipoModelo: s.tipoModelo || null, vidaUtilDias: s.vidaUtilDias, talle: s.talle })) });
      return NextResponse.json({ ok: true, agregados: nuevos.length });
    }
    if (body.accion === "elemento") {
      const { datos, error } = validarElemento(body);
      if (!datos) return NextResponse.json({ error }, { status: 400 });
      const [nS, nP] = await Promise.all([prisma.centroCosto.count({ where: { id: { in: datos.centroCostoIds }, empresaId: empresa.id } }), prisma.puesto.count({ where: { id: { in: datos.puestoIds }, empresaId: empresa.id } })]);
      if (nS !== datos.centroCostoIds.length || nP !== datos.puestoIds.length) return NextResponse.json({ error: "Algún sector o puesto ya no existe. Recargá la página." }, { status: 400 });
      const data = { ...datos, activo: body.activo !== false };
      if (body.id) {
        const { count } = await prisma.elementoEpp.updateMany({ where: { id: String(body.id), empresaId: empresa.id }, data });
        return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se encontró ese elemento." }, { status: 404 });
      }
      await prisma.elementoEpp.create({ data: { ...data, empresaId: empresa.id } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya hay un elemento con ese nombre." }, { status: 409 });
    console.error("Error en POST /api/epp:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? "El catálogo de EPP lo define RR.HH. Vos podés registrar entregas a tu gente." : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
