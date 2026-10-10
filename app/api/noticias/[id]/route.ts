// FM RRHH — app/api/noticias/[id]/route.ts
// GET: quién leyó y quién no (para insistirle al que falta).
// PATCH: archivar / volver a publicar. Archivar la saca del portal sin
// borrar nada: las lecturas y acuses quedan como constancia.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { filtroAudiencia } from "@/lib/noticias";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const empresa = await obtenerEmpresaActual();
  const noticia = empresa ? await prisma.noticia.findFirst({ where: { id: params.id, empresaId: empresa.id }, include: { lecturas: true } }) : null;
  if (!noticia) return NextResponse.json({ error: "No se encontró esa noticia en la empresa actual." }, { status: 404 });

  const destinatarios = await prisma.legajo.findMany({
    where: filtroAudiencia(noticia),
    select: { id: true, numeroLegajo: true, apellido: true, nombre: true, accesoPortal: { select: { activo: true } } },
    orderBy: { numeroLegajo: "asc" },
  });
  const porLegajo = new Map(noticia.lecturas.map((l) => [l.legajoId, l]));
  return NextResponse.json({
    personas: destinatarios.map((d) => ({
      numeroLegajo: d.numeroLegajo, apellido: d.apellido, nombre: d.nombre, tieneAcceso: d.accesoPortal?.activo === true,
      leidaEn: porLegajo.get(d.id)?.leidaEn ?? null, acuseEn: porLegajo.get(d.id)?.acuseEn ?? null,
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { estado } = await req.json().catch(() => ({}));
    if (estado !== "publicada" && estado !== "archivada") return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    const { count } = await prisma.noticia.updateMany({ where: { id: params.id, empresaId: empresa.id }, data: { estado } });
    if (count === 0) return NextResponse.json({ error: "No se encontró esa noticia en la empresa actual." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en PATCH /api/noticias/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo actualizar la noticia." }, { status: 500 });
  }
}
