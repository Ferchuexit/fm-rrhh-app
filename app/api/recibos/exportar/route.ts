// FM RRHH — app/api/recibos/exportar/route.ts
// Descarga masiva de recibos — un solo PDF combinado (una liquidación por
// página), no un ZIP. Se probó la fusión de PDFs con pdf-lib en el sandbox
// antes de escribir esto (no había forma de probar una librería de ZIP sin
// acceso a internet) — ver 60-recibos-masivos.md.
//
// Mismo filtro que ya usa /liquidar (todos / por convenio / por rango de
// legajo) — un solo lugar (lib/liquidar-filtro.ts) decide qué significa
// cada modo, así los dos nunca pueden procesar conjuntos de gente distintos.
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { generarReciboPDF } from "@/lib/recibo-pdf";
import { armarDatosRecibo } from "@/lib/armar-recibo";
import { whereDeFiltro, type FiltroLegajos } from "@/lib/liquidar-filtro";

export async function POST(req: Request) {
  try {
    const { periodoId, filtro } = await req.json();
    if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
    const where = whereDeFiltro(periodo.empresaId, (filtro as FiltroLegajos) ?? { modo: "todos" }, periodo.convenioId);
    const legajos = await prisma.legajo.findMany({ where, orderBy: { numeroLegajo: "asc" } });

    if (legajos.length === 0) {
      return NextResponse.json({ error: "Ningún legajo coincide con este filtro." }, { status: 404 });
    }

    const combinado = await PDFDocument.create();
    const sinLiquidar: number[] = [];

    for (const legajo of legajos) {
      const datos = await armarDatosRecibo(legajo.id, periodoId);
      if (!datos) {
        sinLiquidar.push(legajo.numeroLegajo);
        continue;
      }
      const bytes = await generarReciboPDF(datos);
      const doc = await PDFDocument.load(bytes);
      const paginas = await combinado.copyPages(doc, doc.getPageIndices());
      for (const p of paginas) combinado.addPage(p);
    }

    if (combinado.getPageCount() === 0) {
      return NextResponse.json(
        { error: "Ninguno de los legajos del filtro está liquidado en este período todavía.", legajosSinLiquidar: sinLiquidar },
        { status: 404 }
      );
    }

    const bytesFinal = await combinado.save();

    const nombreArchivo = `recibos_${periodo.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    };
    // Si algún legajo del filtro no estaba liquidado, se avisa en un header
    // propio (no se puede meter en el PDF sin romper el Content-Type) — el
    // cliente lo muestra como advertencia después de la descarga.
    if (sinLiquidar.length > 0) headers["X-Legajos-Sin-Liquidar"] = sinLiquidar.join(",");

    return new NextResponse(Buffer.from(bytesFinal), { headers });
  } catch (e: any) {
    console.error("Error en POST /api/recibos/exportar:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al generar los recibos." }, { status: 500 });
  }
}
