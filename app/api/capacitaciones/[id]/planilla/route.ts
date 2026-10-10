// FM RRHH — app/api/capacitaciones/[id]/planilla/route.ts
// Planilla de la capacitación en PDF: para firmar en papel el día que se
// dicta, o para archivar una vez cerrada (ver lib/capacitacion-pdf.ts).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { NIVELES, TIPOS_CAPACITACION } from "@/lib/capacitaciones-reglas";
import { generarPlanillaCapacitacionPDF } from "@/lib/capacitacion-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const cap = await prisma.capacitacion.findFirst({ where: { id: params.id, empresaId: empresa.id }, include: { habilidad: { select: { nombre: true } }, empresa: { select: { razonSocial: true, cuit: true } } } });
    if (!cap) return NextResponse.json({ error: "No se encontró esa capacitación." }, { status: 404 });
    // Aparte, no anidados: quien está limitado a un sector imprime solo a
    // su gente.
    const asistentes = await prisma.asistenteCapacitacion.findMany({
      where: { capacitacionId: cap.id },
      select: { asistio: true, firmadoEn: true, legajo: { select: { numeroLegajo: true, apellido: true, nombre: true, cuil: true, centroCosto: { select: { nombre: true } } } } },
      orderBy: [{ legajo: { apellido: "asc" } }, { legajo: { nombre: "asc" } }],
    });
    const pdf = await generarPlanillaCapacitacionPDF({
      empresa: cap.empresa.razonSocial, cuit: cap.empresa.cuit,
      titulo: cap.titulo, tipo: TIPOS_CAPACITACION[cap.tipo] ?? cap.tipo, fecha: cap.fecha, horas: cap.horas, instructor: cap.instructor, lugar: cap.lugar, descripcion: cap.descripcion,
      habilita: cap.habilidad && cap.nivelOtorgado ? `${cap.habilidad.nombre} (${NIVELES[cap.nivelOtorgado]?.nombre.toLowerCase() ?? ""})` : null,
      estado: cap.estado,
      asistentes: asistentes.map((a) => ({ legajo: a.legajo.numeroLegajo, nombre: `${a.legajo.apellido}, ${a.legajo.nombre}`, cuil: a.legajo.cuil, sector: a.legajo.centroCosto?.nombre ?? "", asistio: a.asistio, firmadoEn: a.firmadoEn })),
    });
    const fecha = cap.fecha.toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="capacitacion_${fecha}.pdf"` } });
  } catch (e) {
    console.error("Error en GET /api/capacitaciones/[id]/planilla:", e);
    return NextResponse.json({ error: "No se pudo generar la planilla. Probá de nuevo en un momento." }, { status: 500 });
  }
}
