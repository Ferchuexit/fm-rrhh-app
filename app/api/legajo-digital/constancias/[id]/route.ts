// PDF de una constancia firmada, para RR.HH. (imprimir, archivar, mostrar
// en una inspección).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresasAutorizadas } from "@/lib/empresa-actual";
import { generarConstanciaPDF } from "@/lib/constancia-pdf";
import type { Contenido } from "@/lib/legajo-digital";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const c = await prisma.constanciaFirmada.findUnique({ where: { id: params.id }, include: { legajo: { select: { apellido: true, nombre: true, numeroLegajo: true, empresaId: true } } } });
  const autorizadas = await obtenerEmpresasAutorizadas();
  if (!c || !autorizadas.some((e) => e.id === c.legajo.empresaId)) return NextResponse.json({ error: "No se encontró esa constancia." }, { status: 404 });
  const pdf = await generarConstanciaPDF(c.contenido as unknown as Contenido, { firmante: `${c.legajo.apellido}, ${c.legajo.nombre}`, firmadoEn: c.firmadoEn, ip: c.ipFirma, hash: c.hashContenido });
  return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${c.tipo}_legajo_${c.legajo.numeroLegajo}.pdf"` } });
}
