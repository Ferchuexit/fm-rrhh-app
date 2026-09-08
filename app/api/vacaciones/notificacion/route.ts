import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarNotificacionVacacionesPDF } from "@/lib/vacacion-pdf";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vacacionId = searchParams.get("vacacionId");
  if (!vacacionId) return NextResponse.json({ error: "Falta vacacionId" }, { status: 400 });

  const vacacion = await prisma.vacacion.findUniqueOrThrow({ where: { id: vacacionId }, include: { legajo: true } });
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: vacacion.legajo.empresaId } });

  const pdfBytes = await generarNotificacionVacacionesPDF({
    empresa: { razonSocial: empresa.razonSocial, cuit: empresa.cuit },
    legajo: {
      numero: vacacion.legajo.numeroLegajo,
      apellido: vacacion.legajo.apellido,
      nombre: vacacion.legajo.nombre,
      cuil: vacacion.legajo.cuil,
    },
    periodo: {
      anioCorresponde: vacacion.anioCorresponde,
      diasCorresponden: vacacion.diasCorresponden,
      fechaDesde: vacacion.fechaDesde.toISOString().slice(0, 10).split("-").reverse().join("/"),
      fechaHasta: vacacion.fechaHasta.toISOString().slice(0, 10).split("-").reverse().join("/"),
    },
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="notificacion_vacaciones_${vacacion.legajo.numeroLegajo}_${vacacion.legajo.apellido}.pdf"`,
    },
  });
}
