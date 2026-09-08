// FM RRHH — lib/reportes/asistencia-diaria-pdf.ts
// Reporte pensado para Dirección/Producción: de un vistazo, cuánta gente
// hay disponible hoy y quién falta — no un detalle técnico de asistencia.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AZUL_OSCURO = rgb(0.086, 0.227, 0.361);
const VERDE = rgb(0.184, 0.435, 0.369);
const ROJO = rgb(0.698, 0.227, 0.227);
const AMBAR = rgb(0.722, 0.459, 0.169);
const GRIS_CLARO = rgb(0.933, 0.937, 0.925);
const GRIS_TEXTO = rgb(0.4, 0.4, 0.4);

export interface DatosReporteAsistenciaDiaria {
  empresa: string;
  fecha: string; // ya formateada, ej. "Jueves 20 de agosto de 2026"
  totalActivos: number;
  presentes: number; // P + T + SA + S (vino, de una forma u otra)
  ausentes: number; // A + AA
  conLicenciaOJustificado: number; // E + ES + AC + ACS + SUS + LP + VC + VCS + F
  sinDatoCargado: number; // SIN_TURNO + SIN_CONTROL + IMPAR
  porConvenio: { convenio: string; activos: number; presentes: number; ausentes: number }[];
  listaAusentes: { numero: number; apellido: string; nombre: string; convenio: string; categoria: string; motivo: string }[];
}

function pctNum(n: number, total: number) {
  return total > 0 ? (n / total) * 100 : 0;
}
function pctStr(n: number, total: number) {
  return total > 0 ? `${pctNum(n, total).toFixed(1)}%` : "—";
}

interface BarraVertical { etiqueta: string; valor: number; color: { red: number; green: number; blue: number } }

// Gráfico de barras VERTICALES con eje, grilla horizontal cada 25% y
// etiqueta de valor arriba de cada barra — mismo lenguaje visual que los
// gráficos de /kpis (recharts), pero dibujado a mano porque acá no hay
// canvas/navegador, solo pdf-lib del lado del servidor.
function dibujarBarrasVerticales(
  page: any, font: any, fontBold: any,
  x: number, yBase: number, ancho: number, alto: number,
  barras: BarraVertical[], opciones: { sufijo?: string; maxY?: number; grisTexto: any }
) {
  const sufijo = opciones.sufijo ?? "";
  const maxValor = opciones.maxY ?? Math.max(...barras.map((b) => b.valor), 1);
  const anchoEje = 28; // lugar para "100%", "75%", etc.
  const anchoGrafico = ancho - anchoEje;
  const pasos = [0, 0.25, 0.5, 0.75, 1];

  // Grilla + etiquetas del eje Y (0 abajo, máximo arriba)
  for (const p of pasos) {
    const yLinea = yBase - alto + alto * p;
    page.drawLine({
      start: { x: x + anchoEje, y: yLinea }, end: { x: x + ancho, y: yLinea },
      thickness: 0.5, color: rgb(0.88, 0.88, 0.88),
    });
    const etiquetaEje = `${Math.round(maxValor * p)}${sufijo}`;
    const anchoTxt = font.widthOfTextAtSize(etiquetaEje, 6.5);
    page.drawText(etiquetaEje, { x: x + anchoEje - anchoTxt - 4, y: yLinea - 2.5, size: 6.5, font, color: opciones.grisTexto });
  }
  // Eje vertical
  page.drawLine({ start: { x: x + anchoEje, y: yBase - alto }, end: { x: x + anchoEje, y: yBase }, thickness: 0.8, color: rgb(0.6, 0.6, 0.6) });

  const anchoBarra = Math.min(46, (anchoGrafico / barras.length) * 0.55);
  const espacio = anchoGrafico / barras.length;

  barras.forEach((b, i) => {
    const alturaBarra = maxValor > 0 ? (b.valor / maxValor) * alto : 0;
    const xBarra = x + anchoEje + espacio * i + (espacio - anchoBarra) / 2;
    page.drawRectangle({ x: xBarra, y: yBase - alto, width: anchoBarra, height: alturaBarra, color: b.color });

    // Valor arriba de la barra
    const etiquetaValor = `${Math.round(b.valor)}${sufijo}`;
    const anchoEtq = fontBold.widthOfTextAtSize(etiquetaValor, 7.5);
    page.drawText(etiquetaValor, { x: xBarra + anchoBarra / 2 - anchoEtq / 2, y: yBase - alto + alturaBarra + 4, size: 7.5, font: fontBold, color: b.color });

    // Etiqueta de categoría debajo del eje
    const lineasEtiqueta = b.etiqueta.split("\n");
    lineasEtiqueta.forEach((linea, li) => {
      const anchoLinea = font.widthOfTextAtSize(linea, 7);
      page.drawText(linea, { x: xBarra + anchoBarra / 2 - anchoLinea / 2, y: yBase - alto - 11 - li * 9, size: 7, font, color: opciones.grisTexto });
    });
  });
}

// Gráfico de barras verticales AGRUPADAS (2 series por categoría) — se usa
// para comparar Presente% vs Ausente% de cada convenio en un solo gráfico.
function dibujarBarrasAgrupadas(
  page: any, font: any, fontBold: any,
  x: number, yBase: number, ancho: number, alto: number,
  grupos: { etiqueta: string; series: { valor: number; color: any }[] }[],
  opciones: { sufijo?: string; maxY?: number; grisTexto: any }
) {
  const sufijo = opciones.sufijo ?? "";
  const maxValor = opciones.maxY ?? 100;
  const anchoEje = 28;
  const anchoGrafico = ancho - anchoEje;
  const pasos = [0, 0.25, 0.5, 0.75, 1];

  for (const p of pasos) {
    const yLinea = yBase - alto + alto * p;
    page.drawLine({ start: { x: x + anchoEje, y: yLinea }, end: { x: x + ancho, y: yLinea }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) });
    const etiquetaEje = `${Math.round(maxValor * p)}${sufijo}`;
    const anchoTxt = font.widthOfTextAtSize(etiquetaEje, 6.5);
    page.drawText(etiquetaEje, { x: x + anchoEje - anchoTxt - 4, y: yLinea - 2.5, size: 6.5, font, color: opciones.grisTexto });
  }
  page.drawLine({ start: { x: x + anchoEje, y: yBase - alto }, end: { x: x + anchoEje, y: yBase }, thickness: 0.8, color: rgb(0.6, 0.6, 0.6) });

  const espacioGrupo = anchoGrafico / grupos.length;
  const nSeries = grupos[0]?.series.length ?? 1;
  const anchoBarra = Math.min(24, (espacioGrupo * 0.6) / nSeries);

  grupos.forEach((g, gi) => {
    const anchoTotalGrupo = anchoBarra * nSeries;
    const xInicioGrupo = x + anchoEje + espacioGrupo * gi + (espacioGrupo - anchoTotalGrupo) / 2;

    g.series.forEach((s, si) => {
      const alturaBarra = maxValor > 0 ? (s.valor / maxValor) * alto : 0;
      const xBarra = xInicioGrupo + si * anchoBarra;
      page.drawRectangle({ x: xBarra, y: yBase - alto, width: anchoBarra - 2, height: alturaBarra, color: s.color });
      const etiquetaValor = `${Math.round(s.valor)}${sufijo}`;
      const anchoEtq = font.widthOfTextAtSize(etiquetaValor, 6);
      page.drawText(etiquetaValor, { x: xBarra + (anchoBarra - 2) / 2 - anchoEtq / 2, y: yBase - alto + alturaBarra + 3, size: 6, font, color: s.color });
    });

    const anchoLabel = font.widthOfTextAtSize(g.etiqueta, 7);
    page.drawText(g.etiqueta, { x: xInicioGrupo + anchoTotalGrupo / 2 - anchoLabel / 2, y: yBase - alto - 11, size: 7, font, color: opciones.grisTexto });
  });
}

export async function generarReporteAsistenciaDiariaPDF(d: DatosReporteAsistenciaDiaria): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595, 842]); // A4
  const margen = 40;
  let y = 800;

  function texto(t: string, x: number, yy: number, size: number, f = font, color = rgb(0, 0, 0)) {
    page.drawText(t, { x, y: yy, size, font: f, color });
  }

  // Encabezado
  page.drawRectangle({ x: 0, y: 792, width: 595, height: 50, color: AZUL_OSCURO });
  texto("Reporte de Asistencia Diaria", margen, 812, 18, fontBold, rgb(1, 1, 1));
  texto(d.empresa, margen, 796, 10, font, rgb(0.85, 0.88, 0.93));
  y = 770;

  texto(d.fecha, margen, y, 13, fontBold, AZUL_OSCURO);
  y -= 30;

  // Tarjetas resumen
  const tarjetas = [
    { label: "Dotación activa", valor: `${d.totalActivos}`, color: AZUL_OSCURO },
    { label: "Presentes hoy", valor: `${d.presentes} (${pctStr(d.presentes, d.totalActivos)})`, color: VERDE },
    { label: "Ausentes", valor: `${d.ausentes} (${pctStr(d.ausentes, d.totalActivos)})`, color: ROJO },
    { label: "Con licencia / justificado", valor: `${d.conLicenciaOJustificado}`, color: AMBAR },
  ];
  const anchoTarjeta = (595 - margen * 2 - 30) / 4;
  tarjetas.forEach((t, i) => {
    const x = margen + i * (anchoTarjeta + 10);
    page.drawRectangle({ x, y: y - 55, width: anchoTarjeta, height: 55, color: GRIS_CLARO });
    texto(t.label, x + 8, y - 18, 8, font, GRIS_TEXTO);
    texto(t.valor, x + 8, y - 38, 14, fontBold, t.color);
  });
  y -= 80;

  // ── Gráfico de barras verticales: composición de la dotación hoy ──
  const gris2 = rgb(0.75, 0.76, 0.74);
  const segmentos: BarraVertical[] = [
    { valor: d.presentes, color: VERDE, etiqueta: "Presentes" },
    { valor: d.ausentes, color: ROJO, etiqueta: "Ausentes" },
    { valor: d.conLicenciaOJustificado, color: AMBAR, etiqueta: "Licencia/\nJustif." },
    { valor: d.sinDatoCargado, color: gris2, etiqueta: "Sin dato" },
  ].filter((s) => s.valor > 0);

  if (d.totalActivos > 0 && segmentos.length > 0) {
    texto("Composición de la dotación hoy (cantidad de legajos)", margen, y, 11, fontBold, AZUL_OSCURO);
    y -= 14;
    const altoGrafico = 130;
    dibujarBarrasVerticales(page, font, fontBold, margen, y, 555 - margen, altoGrafico, segmentos, { grisTexto: GRIS_TEXTO });
    y -= altoGrafico + 30;
  }

  if (d.sinDatoCargado > 0) {
    texto(`Atención: ${d.sinDatoCargado} legajo(s) sin dato confiable hoy (fichada impar o turno sin cargar) — no incluidos arriba como presentes ni ausentes.`, margen, y, 8, font, AMBAR);
    y -= 20;
  }

  // Por convenio — barras verticales agrupadas (Presente % vs Ausente %), no tabla plana
  if (d.porConvenio.length > 0) {
    if (y < 220) { page = pdf.addPage([595, 842]); y = 800; }
    texto("Por convenio — % presente vs % ausente", margen, y, 11, fontBold, AZUL_OSCURO);
    y -= 14;
    const grupos = d.porConvenio.map((c) => ({
      etiqueta: c.convenio.length > 16 ? c.convenio.substring(0, 15) + "…" : c.convenio,
      series: [
        { valor: pctNum(c.presentes, c.activos), color: VERDE },
        { valor: pctNum(c.ausentes, c.activos), color: ROJO },
      ],
    }));
    const altoGrafico = 130;
    dibujarBarrasAgrupadas(page, font, fontBold, margen, y, 555 - margen, altoGrafico, grupos, { sufijo: "%", maxY: 100, grisTexto: GRIS_TEXTO });
    y -= altoGrafico + 18;

    // Leyenda
    page.drawRectangle({ x: margen, y: y - 8, width: 8, height: 8, color: VERDE });
    texto("% Presente", margen + 12, y - 8, 8, font, GRIS_TEXTO);
    page.drawRectangle({ x: margen + 90, y: y - 8, width: 8, height: 8, color: ROJO });
    texto("% Ausente", margen + 102, y - 8, 8, font, GRIS_TEXTO);
    y -= 26;
  }

  // Lista de ausentes
  texto(`Ausentes hoy (${d.listaAusentes.length})`, margen, y, 11, fontBold, ROJO);
  y -= 18;
  if (d.listaAusentes.length === 0) {
    texto("Nadie ausente sin justificar hoy.", margen, y, 9, font, GRIS_TEXTO);
    y -= 16;
  } else {
    texto("Legajo", margen, y, 8, fontBold, GRIS_TEXTO);
    texto("Nombre", margen + 55, y, 8, fontBold, GRIS_TEXTO);
    texto("Convenio", margen + 240, y, 8, fontBold, GRIS_TEXTO);
    texto("Categoría", margen + 330, y, 8, fontBold, GRIS_TEXTO);
    texto("Motivo", margen + 450, y, 8, fontBold, GRIS_TEXTO);
    y -= 4;
    page.drawLine({ start: { x: margen, y }, end: { x: 555, y }, thickness: 0.5, color: GRIS_TEXTO });
    y -= 13;

    for (const a of d.listaAusentes) {
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      texto(`${a.numero}`, margen, y, 8);
      texto(`${a.apellido}, ${a.nombre}`.substring(0, 32), margen + 55, y, 8);
      texto(a.convenio.substring(0, 18), margen + 240, y, 8);
      texto(a.categoria.substring(0, 20), margen + 330, y, 8);
      texto(a.motivo, margen + 450, y, 8, font, ROJO);
      y -= 13;
    }
  }

  // Pie
  page.drawText("Generado automáticamente por FM RRHH — Sistema de Liquidación de FM Consultora.", {
    x: margen, y: 25, size: 7, font, color: GRIS_TEXTO,
  });

  return pdf.save();
}
