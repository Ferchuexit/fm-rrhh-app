// FM RRHH — app/api/epp/[legajoId]/planilla/route.ts
// La constancia de entrega de EPP de una persona en PDF (lib/epp-pdf.ts).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { leCorresponde } from "@/lib/epp";
import { generarConstanciaEppPDF } from "@/lib/epp-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { legajoId: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const l = await prisma.legajo.findFirst({ where: { id: params.legajoId, empresaId: empresa.id }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, cuil: true, centroCostoId: true, puestoId: true, centroCosto: { select: { nombre: true } }, puesto: { select: { nombre: true } } } });
    if (!l) return NextResponse.json({ error: "No se encontró esa persona." }, { status: 404 });
    const [datos, elementos, entregas] = await Promise.all([
      prisma.empresa.findUnique({ where: { id: empresa.id }, select: { razonSocial: true, cuit: true, domicilio: true } }),
      prisma.elementoEpp.findMany({ where: { empresaId: empresa.id, activo: true }, orderBy: { nombre: "asc" } }),
      prisma.entregaEpp.findMany({ where: { legajoId: l.id }, orderBy: [{ fechaEntrega: "asc" }, { createdAt: "asc" }] }),
    ]);
    // El DNI son los 8 dígitos del medio del CUIL.
    const cuil = l.cuil.replace(/\D/g, "");
    const pdf = await generarConstanciaEppPDF({
      empresa: datos!.razonSocial, cuit: datos!.cuit, domicilio: datos!.domicilio,
      trabajador: `${l.apellido}, ${l.nombre}`, dni: cuil.length === 11 ? String(Number(cuil.slice(2, 10))) : "", legajo: l.numeroLegajo, puesto: l.puesto?.nombre ?? null, sector: l.centroCosto?.nombre ?? null,
      necesarios: elementos.filter((e) => leCorresponde(e, l)).map((e) => e.nombre),
      entregas: entregas.map((e) => ({ producto: e.producto, tipoModelo: e.tipoModelo, marca: e.marca, certificado: e.certificado, cantidad: e.cantidad, talle: e.talle, fechaEntrega: e.fechaEntrega, firmadoEn: e.firmadoEn, enPapel: e.enPapel })),
    });
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="EPP_${l.apellido.replace(/[^\w]+/g, "_")}_${l.numeroLegajo}.pdf"` } });
  } catch (e) {
    console.error("Error en GET /api/epp/[legajoId]/planilla:", e);
    return NextResponse.json({ error: "No se pudo generar la planilla." }, { status: 500 });
  }
}
