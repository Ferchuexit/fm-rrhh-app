// FM RRHH — app/api/biblioteca/[id]/route.ts
// Un artículo: quién lo abrió, y publicarlo, archivarlo o borrarlo.
//   POST accion "publicar" (con avisar: true avisa a quienes les corresponde)
//   POST accion "archivar" / "borrador"
//   DELETE → borra (solo un borrador o un archivado)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { avisar } from "@/lib/avisos";

export const dynamic = "force-dynamic";
const falla = (e: any, donde: string) => {
  console.error(`Error en ${donde} /api/biblioteca/[id]:`, e);
  return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? "La librería la carga RR.HH." : "No se pudo completar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
};
const invitados = (a: { empresaId: string; centroCostoIds: string[] }) => ({ empresaId: a.empresaId, condicion: "activo", ...(a.centroCostoIds.length ? { centroCostoId: { in: a.centroCostoIds } } : {}) });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const a = await prisma.articuloBiblioteca.findFirst({ where: { id: params.id, empresaId: empresa.id }, select: { id: true, empresaId: true, centroCostoIds: true } });
    if (!a) return NextResponse.json({ error: "No se encontró ese artículo." }, { status: 404 });
    const [gente, lecturas] = await Promise.all([
      prisma.legajo.findMany({ where: invitados(a), select: { id: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
      prisma.lecturaBiblioteca.findMany({ where: { articuloId: a.id }, select: { legajoId: true, leidoEn: true } }),
    ]);
    const leyo = new Map(lecturas.map((l) => [l.legajoId, l.leidoEn]));
    return NextResponse.json({ personas: gente.map((l) => ({ id: l.id, nombre: `${l.apellido}, ${l.nombre}`, sector: l.centroCosto?.nombre ?? "Sin asignar", leidoEn: leyo.get(l.id) ?? null })) });
  } catch (e) { return falla(e, "GET"); }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const a = await prisma.articuloBiblioteca.findFirst({ where: { id: params.id, empresaId: empresa.id }, select: { id: true, empresaId: true, titulo: true, estado: true, centroCostoIds: true } });
    if (!a) return NextResponse.json({ error: "No se encontró ese artículo." }, { status: 404 });
    if (body.accion === "publicar") {
      await prisma.articuloBiblioteca.update({ where: { id: a.id }, data: { estado: "publicado", publicadoEn: new Date() } });
      let avisados = 0;
      if (body.avisar === true) {
        const gente = await prisma.legajo.findMany({ where: invitados(a), select: { id: true } });
        avisados = (await avisar(gente.map((l) => l.id), { tipo: "biblioteca", titulo: "Material nuevo para consultar", cuerpo: `${a.titulo.slice(0, 90)}. Lo encontrás en la Librería del portal.`, url: `/portal/biblioteca/${a.id}` })).personas;
      }
      return NextResponse.json({ ok: true, avisados });
    }
    if (body.accion === "archivar" || body.accion === "borrador") {
      await prisma.articuloBiblioteca.update({ where: { id: a.id }, data: { estado: body.accion === "archivar" ? "archivado" : "borrador" } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) { return falla(e, "POST"); }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { count } = await prisma.articuloBiblioteca.deleteMany({ where: { id: params.id, empresaId: empresa.id, estado: { in: ["borrador", "archivado"] } } });
    return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Un artículo publicado no se borra de una: archivalo primero (deja de verse en el portal)." }, { status: 409 });
  } catch (e) { return falla(e, "DELETE"); }
}
