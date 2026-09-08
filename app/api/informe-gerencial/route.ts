import { NextResponse } from "next/server";
import { obtenerDatosInformeGerencial } from "@/lib/informe-gerencial";
import { armarResumenEjecutivo, armarRecomendaciones } from "@/lib/informe-gerencial-contenido";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, convertInchesToTwip,
} from "docx";

const ANCHO_TABLA = 9000; // DXA — A4 con márgenes por defecto deja ~9000-9500 de ancho útil

function celda(texto: string, opciones: { ancho: number; negrita?: boolean; fondo?: string; alineacion?: (typeof AlignmentType)[keyof typeof AlignmentType] }) {
  return new TableCell({
    width: { size: opciones.ancho, type: WidthType.DXA },
    shading: opciones.fondo ? { type: ShadingType.CLEAR, color: "auto", fill: opciones.fondo } : undefined,
    children: [
      new Paragraph({
        alignment: opciones.alineacion,
        children: [new TextRun({ text: texto, bold: opciones.negrita })],
      }),
    ],
  });
}

function tablaIndicadores(d: Awaited<ReturnType<typeof obtenerDatosInformeGerencial>>) {
  const anchoCol = [ANCHO_TABLA * 0.4, ANCHO_TABLA * 0.3, ANCHO_TABLA * 0.3];
  const fmt = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  const fmtPct = (n: number | null) => (n === null ? "sin dato anterior" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

  const filas = [
    ["Costo laboral", fmt(d.costoLaboral.actual), fmtPct(d.costoLaboral.variacionPct)],
    ["Dotación", String(d.dotacion.actual), d.dotacion.anterior !== null ? `${d.dotacion.actual - d.dotacion.anterior >= 0 ? "+" : ""}${d.dotacion.actual - d.dotacion.anterior}` : "sin dato anterior"],
    ["Ausentismo", d.ausentismoPct.actual !== null ? `${d.ausentismoPct.actual.toFixed(1)}%` : "—", d.ausentismoPct.variacionPuntos !== null ? `${d.ausentismoPct.variacionPuntos >= 0 ? "+" : ""}${d.ausentismoPct.variacionPuntos.toFixed(1)} pts` : "sin dato anterior"],
    ["Horas extra (importe)", fmt(d.horasExtra.actual), fmtPct(d.horasExtra.variacionPct)],
    ["Costo por empleado", fmt(d.costoPorEmpleado.actual), fmtPct(d.costoPorEmpleado.variacionPct)],
  ];

  return new Table({
    width: { size: ANCHO_TABLA, type: WidthType.DXA },
    columnWidths: anchoCol,
    rows: [
      new TableRow({
        children: [
          celda("Indicador", { ancho: anchoCol[0], negrita: true, fondo: "D9D9D9" }),
          celda("Valor actual", { ancho: anchoCol[1], negrita: true, fondo: "D9D9D9", alineacion: AlignmentType.RIGHT }),
          celda("Variación", { ancho: anchoCol[2], negrita: true, fondo: "D9D9D9", alineacion: AlignmentType.RIGHT }),
        ],
      }),
      ...filas.map(
        ([indicador, valor, variacion]) =>
          new TableRow({
            children: [
              celda(indicador, { ancho: anchoCol[0] }),
              celda(valor, { ancho: anchoCol[1], alineacion: AlignmentType.RIGHT }),
              celda(variacion, { ancho: anchoCol[2], alineacion: AlignmentType.RIGHT }),
            ],
          })
      ),
    ],
  });
}

function tablaDistribucion(d: Awaited<ReturnType<typeof obtenerDatosInformeGerencial>>) {
  const anchoCol = [ANCHO_TABLA * 0.4, ANCHO_TABLA * 0.3, ANCHO_TABLA * 0.3];
  const fmt = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

  return new Table({
    width: { size: ANCHO_TABLA, type: WidthType.DXA },
    columnWidths: anchoCol,
    rows: [
      new TableRow({
        children: [
          celda("Convenio", { ancho: anchoCol[0], negrita: true, fondo: "D9D9D9" }),
          celda("Dotación", { ancho: anchoCol[1], negrita: true, fondo: "D9D9D9", alineacion: AlignmentType.RIGHT }),
          celda("Costo laboral", { ancho: anchoCol[2], negrita: true, fondo: "D9D9D9", alineacion: AlignmentType.RIGHT }),
        ],
      }),
      ...d.distribucionPorConvenio.map(
        (c) =>
          new TableRow({
            children: [
              celda(c.convenio, { ancho: anchoCol[0] }),
              celda(String(c.cantidad), { ancho: anchoCol[1], alineacion: AlignmentType.RIGHT }),
              celda(fmt(c.costoLaboral), { ancho: anchoCol[2], alineacion: AlignmentType.RIGHT }),
            ],
          })
      ),
    ],
  });
}

function listaBullet(items: string[]) {
  return items.map(
    (texto) =>
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun(texto)],
      })
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

  try {
    const datos = await obtenerDatosInformeGerencial(periodoId);
    const resumen = armarResumenEjecutivo(datos);
    const recomendaciones = armarRecomendaciones(datos);

    const desviosRojos = datos.desvios.filter((d) => d.severidad === "rojo");
    const desviosAmarillos = datos.desvios.filter((d) => d.severidad === "amarillo");

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: "bullets",
            levels: [{ level: 0, format: "bullet" as any, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) } } } }],
          },
        ],
      },
      sections: [
        {
          children: [
            new Paragraph({ text: "Informe Gerencial", heading: HeadingLevel.TITLE }),
            new Paragraph({ text: `${datos.empresa.razonSocial} — ${datos.periodoActual.nombre}`, spacing: { after: 300 } }),

            new Paragraph({ text: "Resumen ejecutivo", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: resumen, spacing: { after: 300 } }),

            new Paragraph({ text: "Indicadores clave", heading: HeadingLevel.HEADING_1 }),
            tablaIndicadores(datos),
            new Paragraph({ text: "", spacing: { after: 300 } }),

            new Paragraph({ text: "Distribución por convenio", heading: HeadingLevel.HEADING_1 }),
            datos.distribucionPorConvenio.length > 0
              ? tablaDistribucion(datos)
              : new Paragraph({ text: "Sin liquidaciones vigentes en este período todavía." }),
            new Paragraph({ text: "", spacing: { after: 300 } }),

            new Paragraph({ text: "Alertas y observaciones", heading: HeadingLevel.HEADING_1 }),
            ...(desviosRojos.length > 0
              ? [new Paragraph({ children: [new TextRun({ text: "Alertas (rojo):", bold: true })] }), ...listaBullet(desviosRojos.map((d) => d.mensaje))]
              : []),
            ...(desviosAmarillos.length > 0
              ? [new Paragraph({ children: [new TextRun({ text: "Observaciones (amarillo):", bold: true })], spacing: { before: 200 } }), ...listaBullet(desviosAmarillos.map((d) => d.mensaje))]
              : []),
            ...(desviosRojos.length === 0 && desviosAmarillos.length === 0 ? [new Paragraph({ text: "Sin alertas ni observaciones en este período." })] : []),
            new Paragraph({ text: "", spacing: { after: 300 } }),

            new Paragraph({ text: "Recomendaciones", heading: HeadingLevel.HEADING_1 }),
            ...listaBullet(recomendaciones),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const nombreArchivo = `informe-gerencial-${datos.periodoActual.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      },
    });
  } catch (e: any) {
    console.error("Error en GET /api/informe-gerencial:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo generar el informe." }, { status: 500 });
  }
}
