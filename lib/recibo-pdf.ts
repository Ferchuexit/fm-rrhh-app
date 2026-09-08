// FM RRHH — lib/recibo-pdf.ts
// Recibo conforme al modelo único del Anexo III del Decreto 407/2026
// (reglamentario del art. 140 LCT, reformado por la Ley 27.802 de
// Modernización Laboral) — ver 54-recibo-ley27802.md.
//
// Puerto a pdf-lib desde el prototipo validado en reportlab
// (generar_recibos_ley27802.py, ya probado visualmente contra un legajo real
// antes de portarlo). El diseño (4 secciones, columnas, colores, torta) es
// el mismo — lo que cambia es la librería.
//
// ⚠️ Nota sobre drawSvgPath: pdf-lib invierte el eje Y para los paths SVG
// (Y crece hacia abajo, como en SVG normal — al revés que el resto de
// pdf-lib). Las coordenadas de la torta están pensadas en ese sistema
// "estilo SVG" con origen arriba-izquierda del recuadro del gráfico, no en
// el sistema normal de pdf-lib. Probado aparte en el sandbox antes de
// escribir esto (ver 54-recibo-ley27802.md) — drawSvgPath con coordenadas
// "normales" no dibuja nada, queda fuera de la página.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type Color } from "pdf-lib";

const INK = rgb(0.102, 0.133, 0.216);
const VERDE = rgb(0.184, 0.435, 0.369);
const GRIS_CLARO = rgb(0.933, 0.937, 0.925);
const GRIS_BORDE = rgb(0.847, 0.855, 0.827);
const GRIS_TEXTO = rgb(0.4, 0.4, 0.4);
const BLANCO = rgb(1, 1, 1);

const COLOR_RUBRO: Record<string, Color> = {
  neto: VERDE,
  seguridad_social: rgb(0.235, 0.353, 0.471),
  obra_social: rgb(0.431, 0.549, 0.678),
  art: rgb(0.722, 0.459, 0.169),
  sindical: rgb(0.549, 0.416, 0.612),
  otros: rgb(0.604, 0.604, 0.557),
};
const NOMBRE_RUBRO: Record<string, string> = {
  neto: "Sueldo neto",
  seguridad_social: "Seguridad Social (Jub./INSSJP)",
  obra_social: "Obra Social",
  art: "ART",
  sindical: "Sindical",
  otros: "Otros (SCVO, etc.)",
};

function money(v: number) {
  const signo = v < 0 ? "-" : "";
  return signo + "$ " + Math.abs(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface HaberRecibo { codigo: string; nombre: string; cant: string; tipo: "remunerativo" | "no_remunerativo"; importe: number }
export interface DeduccionRecibo { codigo: string; nombre: string; pct: string; importe: number; rubro?: string }
export interface ContribucionRecibo { nombre: string; base: number; importe: number; rubro: string }

export interface DatosRecibo {
  empresa: { razonSocial: string; cuit: string; domicilio: string };
  legajo: {
    numero: number; apellido: string; nombre: string; cuil: string; categoria: string; convenio: string;
    antiguedadAnios: number; fechaIngreso: string; obraSocial: string; banco: string;
  };
  periodo: { etiqueta: string; fechaPago: string };
  haberes: HaberRecibo[];
  deducciones: DeduccionRecibo[];
  contribuciones: ContribucionRecibo[];
}

// ── Geometría de la torta — coordenadas "estilo SVG" (Y hacia abajo, origen
// arriba-izquierda del recuadro). Ver nota grande al principio del archivo. ──
function puntoEnCirculo(cx: number, cy: number, r: number, anguloRad: number) {
  return { x: cx + r * Math.sin(anguloRad), y: cy - r * Math.cos(anguloRad) };
}
function pathPorcion(cx: number, cy: number, r: number, anguloInicio: number, anguloFin: number) {
  const p1 = puntoEnCirculo(cx, cy, r, anguloInicio);
  const p2 = puntoEnCirculo(cx, cy, r, anguloFin);
  const largeArc = anguloFin - anguloInicio > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

export async function generarReciboPDF(datos: DatosRecibo): Promise<Uint8Array> {
  const { empresa, legajo, periodo, haberes, deducciones, contribuciones } = datos;

  const remunerativo = haberes.filter((h) => h.tipo === "remunerativo").reduce((a, h) => a + h.importe, 0);
  const noRemunerativo = haberes.filter((h) => h.tipo === "no_remunerativo").reduce((a, h) => a + h.importe, 0);
  const bruto = remunerativo + noRemunerativo;
  const totalDescuentos = deducciones.reduce((a, d) => a + d.importe, 0); // positivo
  const neto = bruto - totalDescuentos;
  const subtotalContribuciones = contribuciones.reduce((a, c) => a + c.importe, 0);
  const costoLaboralTotal = bruto + subtotalContribuciones;

  const composicion: Record<string, number> = { neto };
  // Los aportes que se le retienen al EMPLEADO (Jubilación, Obra Social,
  // Sindicato...) van al mismo destino que la contribución PATRONAL
  // equivalente — se agrupan en el mismo rubro, no se pierden. Sin esto,
  // la torta no llega a sumar el costo laboral total completo (queda un
  // "espacio en blanco" sin dibujar, justo la porción que paga el
  // empleado vía retención en vez de la empresa vía contribución).
  for (const d of deducciones) {
    const rubro = d.rubro ?? "otros";
    composicion[rubro] = (composicion[rubro] ?? 0) + d.importe;
  }
  for (const c of contribuciones) composicion[c.rubro] = (composicion[c.rubro] ?? 0) + c.importe;
  const rubros = Object.keys(composicion).filter((r) => composicion[r] > 0);

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const marginX = 45;
  const anchoUtil = 595 - marginX * 2; // 505
  let y = 800;

  // ── Encabezado ──
  page.drawRectangle({ x: 0, y: y - 6, width: 595, height: 56, color: INK });
  page.drawText(empresa.razonSocial, { x: marginX, y: y + 22, size: 11, font: bold, color: BLANCO });
  page.drawText(`CUIT: ${empresa.cuit} | ${empresa.domicilio}`, { x: marginX, y: y + 8, size: 7.5, font: normal, color: BLANCO, maxWidth: 320, lineHeight: 10 });

  const tituloDer = "RECIBO DE HABERES";
  page.drawText(tituloDer, { x: 595 - marginX - bold.widthOfTextAtSize(tituloDer, 11), y: y + 22, size: 11, font: bold, color: BLANCO });
  const periodoTxt = periodo.etiqueta;
  page.drawText(periodoTxt, { x: 595 - marginX - normal.widthOfTextAtSize(periodoTxt, 8), y: y + 10, size: 8, font: normal, color: BLANCO });
  const leyTxt = "Formato conforme Ley 27.802 / Decreto 407/2026";
  page.drawText(leyTxt, { x: 595 - marginX - italic.widthOfTextAtSize(leyTxt, 7), y: y, size: 7, font: italic, color: BLANCO });
  y -= 50;

  const seccion = (titulo: string) => {
    page.drawText(titulo, { x: marginX, y, size: 10, font: bold, color: INK });
    y -= 16;
  };
  const dato = (x: number, label: string, valor: string) => {
    page.drawText(label, { x, y, size: 8.5, font: bold, color: INK });
    const anchoLabel = bold.widthOfTextAtSize(label + " ", 8.5);
    page.drawText(valor, { x: x + anchoLabel, y, size: 8.5, font: normal, color: INK });
  };

  // ── 1. Identificación ──
  seccion("1. IDENTIFICACIÓN");
  dato(marginX, "Legajo:", String(legajo.numero));
  dato(marginX + 260, "CUIL:", legajo.cuil);
  y -= 15;
  dato(marginX, "Apellido y Nombre:", `${legajo.apellido.toUpperCase()}, ${legajo.nombre}`);
  y -= 15;
  dato(marginX, "Categoría:", `${legajo.categoria} (${legajo.convenio})`);
  dato(marginX + 260, "Antigüedad:", `${legajo.antiguedadAnios} años`);
  y -= 15;
  dato(marginX, "Fecha de ingreso:", legajo.fechaIngreso);
  dato(marginX + 260, "Obra Social:", legajo.obraSocial);
  y -= 22;

  // ── 2. Contribuciones del empleador ──
  seccion("2. CONTRIBUCIONES DEL EMPLEADOR (costo laboral patronal)");
  const colsContrib = [280, 110, 115]; // Concepto | Base | Importe
  page.drawRectangle({ x: marginX, y: y - 3, width: anchoUtil, height: 15, color: GRIS_CLARO });
  page.drawText("Concepto", { x: marginX + 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("Base", { x: marginX + colsContrib[0] + colsContrib[1] - bold.widthOfTextAtSize("Base", 7.5) - 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("Importe", { x: marginX + anchoUtil - bold.widthOfTextAtSize("Importe", 7.5) - 4, y: y + 1, size: 7.5, font: bold, color: INK });
  y -= 16;
  for (const c of contribuciones) {
    page.drawText(c.nombre, { x: marginX + 4, y, size: 7.8, font: normal, color: INK });
    const txtBase = money(c.base);
    page.drawText(txtBase, { x: marginX + colsContrib[0] + colsContrib[1] - normal.widthOfTextAtSize(txtBase, 7.8) - 4, y, size: 7.8, font: normal, color: INK });
    const txtImp = money(c.importe);
    page.drawText(txtImp, { x: marginX + anchoUtil - normal.widthOfTextAtSize(txtImp, 7.8) - 4, y, size: 7.8, font: normal, color: INK });
    y -= 14;
  }
  if (contribuciones.length === 0) {
    page.drawText("Pendiente de cargar — ver documentación del proyecto.", { x: marginX + 4, y, size: 7.5, font: italic, color: GRIS_TEXTO });
    y -= 14;
  }
  y -= 2;
  page.drawText("Subtotal contribuciones patronales", { x: marginX + 4, y, size: 8, font: normal, color: INK });
  const txtSub = money(subtotalContribuciones);
  page.drawText(txtSub, { x: marginX + anchoUtil - normal.widthOfTextAtSize(txtSub, 8) - 4, y, size: 8, font: normal, color: INK });
  y -= 15;
  page.drawLine({ start: { x: marginX, y: y + 11 }, end: { x: marginX + anchoUtil, y: y + 11 }, thickness: 0.6, color: INK });
  page.drawText("COSTO LABORAL TOTAL", { x: marginX + 4, y, size: 8.5, font: bold, color: VERDE });
  const txtCosto = money(costoLaboralTotal);
  page.drawText(txtCosto, { x: marginX + anchoUtil - bold.widthOfTextAtSize(txtCosto, 8.5) - 4, y, size: 8.5, font: bold, color: VERDE });
  y -= 22;

  // ── 3. Remuneración bruta y deducciones ──
  seccion("3. REMUNERACIÓN BRUTA Y DEDUCCIONES");
  // Cód. | Concepto | Cant. | Remunerativo | No remunerativo
  const cHab = [38, 195, 45, 108, marginX + anchoUtil]; // posiciones acumuladas de inicio de cada columna
  const xCod = marginX, xConcepto = marginX + 38, xCant = marginX + 38 + 195, xRem = marginX + 38 + 195 + 45, xNoRem = marginX + 38 + 195 + 45 + 108;
  page.drawRectangle({ x: marginX, y: y - 3, width: anchoUtil, height: 15, color: GRIS_CLARO });
  page.drawText("Cód.", { x: xCod + 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("Concepto", { x: xConcepto + 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("Cant.", { x: xCant + 45 - bold.widthOfTextAtSize("Cant.", 7.5) - 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("Remunerativo", { x: xRem + 108 - bold.widthOfTextAtSize("Remunerativo", 7.5) - 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("No remunerativo", { x: marginX + anchoUtil - bold.widthOfTextAtSize("No remunerativo", 7.5) - 4, y: y + 1, size: 7.5, font: bold, color: INK });
  y -= 16;
  for (const h of haberes) {
    page.drawText(h.codigo, { x: xCod + 4, y, size: 7.8, font: normal, color: INK });
    page.drawText(h.nombre, { x: xConcepto + 4, y, size: 7.8, font: normal, color: INK });
    page.drawText(h.cant, { x: xCant + 45 - normal.widthOfTextAtSize(h.cant, 7.8) - 4, y, size: 7.8, font: normal, color: INK });
    if (h.tipo === "remunerativo") {
      const t = money(h.importe);
      page.drawText(t, { x: xRem + 108 - normal.widthOfTextAtSize(t, 7.8) - 4, y, size: 7.8, font: normal, color: INK });
    } else {
      const t = money(h.importe);
      page.drawText(t, { x: marginX + anchoUtil - normal.widthOfTextAtSize(t, 7.8) - 4, y, size: 7.8, font: normal, color: INK });
    }
    y -= 14;
  }
  y -= 2;
  page.drawLine({ start: { x: xCant, y: y + 11 }, end: { x: marginX + anchoUtil, y: y + 11 }, thickness: 0.6, color: INK });
  page.drawText("Total Bruto:", { x: xCant + 4, y, size: 8, font: bold, color: INK });
  const txtRem = money(remunerativo);
  page.drawText(txtRem, { x: xRem + 108 - bold.widthOfTextAtSize(txtRem, 8) - 4, y, size: 8, font: bold, color: INK });
  const txtNoRem = money(noRemunerativo);
  page.drawText(txtNoRem, { x: marginX + anchoUtil - bold.widthOfTextAtSize(txtNoRem, 8) - 4, y, size: 8, font: bold, color: INK });
  y -= 20;

  // Deducciones — Cód. | Concepto | % | Importe (el % alineado con la
  // columna "Cant." de arriba, a pedido explícito)
  const xPct = xCant, xImporteDesc = xRem;
  page.drawRectangle({ x: marginX, y: y - 3, width: anchoUtil, height: 15, color: GRIS_CLARO });
  page.drawText("Cód.", { x: xCod + 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("Concepto", { x: xConcepto + 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("%", { x: xPct + 45 - bold.widthOfTextAtSize("%", 7.5) - 4, y: y + 1, size: 7.5, font: bold, color: INK });
  page.drawText("Importe", { x: marginX + anchoUtil - bold.widthOfTextAtSize("Importe", 7.5) - 4, y: y + 1, size: 7.5, font: bold, color: INK });
  y -= 16;
  for (const d of deducciones) {
    page.drawText(d.codigo, { x: xCod + 4, y, size: 7.8, font: normal, color: INK });
    page.drawText(d.nombre, { x: xConcepto + 4, y, size: 7.8, font: normal, color: INK });
    page.drawText(d.pct, { x: xPct + 45 - normal.widthOfTextAtSize(d.pct, 7.8) - 4, y, size: 7.8, font: normal, color: INK });
    const t = money(-Math.abs(d.importe));
    page.drawText(t, { x: marginX + anchoUtil - normal.widthOfTextAtSize(t, 7.8) - 4, y, size: 7.8, font: normal, color: INK });
    y -= 14;
  }
  y -= 2;
  page.drawLine({ start: { x: xConcepto, y: y + 11 }, end: { x: marginX + anchoUtil, y: y + 11 }, thickness: 0.6, color: INK });
  page.drawText("Total Deducciones:", { x: xConcepto + 4, y, size: 8, font: bold, color: INK });
  const txtDesc = money(-totalDescuentos);
  page.drawText(txtDesc, { x: marginX + anchoUtil - bold.widthOfTextAtSize(txtDesc, 8) - 4, y, size: 8, font: bold, color: INK });
  y -= 24;

  // ── 4. Remuneración neta + gráfico de torta ──
  seccion("4. REMUNERACIÓN NETA");
  const yTituloSeccion4 = y + 16; // referencia para alinear la torta con el texto

  // Monto neto, a la izquierda
  const netoTxt = money(neto);
  page.drawText(netoTxt, { x: marginX, y: y - 18, size: 20, font: bold, color: VERDE });
  page.drawText("Monto acreditado en cuenta sueldo.", { x: marginX, y: y - 34, size: 7, font: normal, color: GRIS_TEXTO });
  page.drawText("Ver detalle de composición del costo laboral ->", { x: marginX, y: y - 44, size: 7, font: normal, color: GRIS_TEXTO });

  // Torta — coordenadas "estilo SVG" (Y hacia abajo), centro en un recuadro
  // de 100x100 puesto a partir de (xTorta, yTortaArriba)
  const xTorta = marginX + 210, yTortaArriba = y + 10, rTorta = 45, cxLocal = 50, cyLocal = 50;
  let anguloActual = 0;
  for (const r of rubros) {
    const anguloPorcion = (composicion[r] / costoLaboralTotal) * 2 * Math.PI;
    const path = pathPorcion(cxLocal, cyLocal, rTorta, anguloActual, anguloActual + anguloPorcion);
    page.drawSvgPath(path, { x: xTorta, y: yTortaArriba, color: COLOR_RUBRO[r] ?? rgb(0.6, 0.6, 0.6), borderColor: BLANCO, borderWidth: 1.2 });
    anguloActual += anguloPorcion;
  }

  // Leyenda, a la derecha de la torta
  let yLeyenda = y - 2;
  const xLeyenda = xTorta + 115;
  for (const r of rubros) {
    const pct = (composicion[r] / costoLaboralTotal) * 100;
    page.drawRectangle({ x: xLeyenda, y: yLeyenda - 6, width: 8, height: 8, color: COLOR_RUBRO[r] ?? rgb(0.6, 0.6, 0.6) });
    page.drawText(NOMBRE_RUBRO[r] ?? r, { x: xLeyenda + 12, y: yLeyenda - 5, size: 7, font: normal, color: INK });
    const txt = `${pct.toFixed(1)}%  (${money(composicion[r])})`;
    page.drawText(txt, { x: xLeyenda + 130, y: yLeyenda - 5, size: 7, font: normal, color: INK });
    yLeyenda -= 15;
  }

  y -= 100;
  page.drawLine({ start: { x: marginX, y }, end: { x: marginX + anchoUtil, y }, thickness: 0.5, color: GRIS_BORDE });
  y -= 12;
  const pie = `Lugar y fecha de pago: ${empresa.domicilio} — ${periodo.fechaPago}. Fecha de depósito de aportes y contribuciones: dentro de los plazos establecidos por ARCA (ex AFIP). Banco interviniente: ${legajo.banco || "s/d"} (Art. 12, Decreto-Ley 17.250/67).`;
  page.drawText(pie, { x: marginX, y, size: 6.5, font: normal, color: GRIS_TEXTO, maxWidth: anchoUtil, lineHeight: 8.5 });
  y -= 24;
  page.drawText(
    "De acuerdo a la Ley 27.802 y su Decreto Reglamentario 407/2026, este recibo no requiere firma en duplicado papel. La acreditación bancaria del haber constituye constancia válida de pago.",
    { x: marginX, y, size: 6.5, font: normal, color: GRIS_TEXTO, maxWidth: anchoUtil, lineHeight: 8.5 }
  );

  return doc.save();
}
