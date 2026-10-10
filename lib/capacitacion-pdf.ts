// FM RRHH — lib/capacitacion-pdf.ts
// Planilla de una capacitación en PDF, para imprimir. Sirve en dos momentos:
//   - ANTES (programada): sale con la columna de firma en blanco, para que
//     cada asistente firme de puño y letra el día de la capacitación.
//   - DESPUÉS (realizada): además muestra quién estuvo presente y quién ya
//     la confirmó desde el portal, con fecha y hora. Es el papel para
//     archivar o mostrar en una inspección.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const INK = rgb(0.086, 0.227, 0.361);
const GRIS = rgb(0.35, 0.37, 0.4);
const LINEA = rgb(0.75, 0.78, 0.81);

// Las fuentes estándar de PDF solo conocen Latin-1 (ver constancia-pdf.ts).
const limpio = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA1-\xFF]/g, "?");

function partir(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of limpio(texto.replace(/\r/g, "")).split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, size) > ancho && actual) { lineas.push(actual); actual = palabra; } else actual = prueba;
    }
    lineas.push(actual);
  }
  return lineas;
}
function recortar(texto: string, font: PDFFont, size: number, ancho: number): string {
  let t = limpio(texto);
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > ancho) t = t.slice(0, -2) + ".";
  return t;
}

export interface PlanillaCapacitacion {
  empresa: string; cuit: string;
  titulo: string; tipo: string; fecha: Date; horas: number | null; instructor: string | null; lugar: string | null; descripcion: string | null;
  habilita: string | null; // "Autoelevador (autónomo)"
  estado: string;
  asistentes: { legajo: number; nombre: string; cuil: string; sector: string; asistio: boolean | null; firmadoEn: Date | null }[];
}

const dia = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const diaHora = (d: Date) => d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" });

export async function generarPlanillaCapacitacionPDF(p: PlanillaCapacitacion): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const X = 40, ANCHO = 515, ALTO_FILA = 30, PIE = 60;
  const realizada = p.estado === "realizada";
  // n° · legajo · apellido y nombre · CUIL · sector · asistencia · firma
  const COL = [22, 40, 150, 78, 75, 55, 95];
  const TITULOS = ["N°", "Legajo", "Apellido y nombre", "CUIL", "Sector", realizada ? "Asistencia" : "", "Firma"];
  const xCol = (i: number) => X + COL.slice(0, i).reduce((a, b) => a + b, 0);

  let page!: PDFPage;
  let y = 0;
  const encabezadoTabla = () => {
    page.drawRectangle({ x: X, y: y - 6, width: ANCHO, height: 18, color: INK });
    TITULOS.forEach((t, i) => page.drawText(t, { x: xCol(i) + 4, y, size: 8, font: bold, color: rgb(1, 1, 1) }));
    y -= 6;
  };
  const nuevaPagina = (primera: boolean) => {
    page = doc.addPage([595, 842]);
    y = 800;
    page.drawText(limpio(p.empresa), { x: X, y, size: 9, font: bold, color: GRIS });
    page.drawText(limpio(`CUIT ${p.cuit}`), { x: X + ANCHO - normal.widthOfTextAtSize(`CUIT ${p.cuit}`, 9), y, size: 9, font: normal, color: GRIS });
    y -= 22;
    page.drawText(primera ? "REGISTRO DE CAPACITACIÓN" : limpio(`REGISTRO DE CAPACITACIÓN - ${recortar(p.titulo, bold, 13, 300)} (cont.)`), { x: X, y, size: 13, font: bold, color: INK });
    y -= 8;
    page.drawLine({ start: { x: X, y }, end: { x: X + ANCHO, y }, thickness: 1.2, color: INK });
    y -= 20;
  };

  nuevaPagina(true);
  const dato = (label: string, valor: string) => {
    page.drawText(label, { x: X, y, size: 9.5, font: bold, color: INK });
    for (const l of partir(valor, normal, 9.5, ANCHO - 95)) { page.drawText(l, { x: X + 95, y, size: 9.5, font: normal, color: INK }); y -= 13; }
    y -= 2;
  };
  dato("Tema:", p.titulo);
  dato("Tipo:", p.tipo);
  dato("Fecha:", `${dia(p.fecha)}${p.horas ? `   -   Duración: ${String(p.horas).replace(".", ",")} hs` : ""}${p.lugar ? `   -   Lugar: ${p.lugar}` : ""}`);
  dato("Dictada por:", p.instructor || "____________________________________");
  if (p.habilita) dato("Habilita para:", p.habilita);
  if (p.descripcion) dato("Contenidos:", p.descripcion.slice(0, 1000));
  if (p.estado === "cancelada") { page.drawText("CAPACITACIÓN CANCELADA", { x: X, y, size: 10, font: bold, color: rgb(0.7, 0.23, 0.23) }); y -= 15; }
  y -= 12;
  encabezadoTabla();

  p.asistentes.forEach((a, n) => {
    if (y - ALTO_FILA < PIE) { nuevaPagina(false); encabezadoTabla(); }
    const base = y - ALTO_FILA;
    page.drawLine({ start: { x: X, y: base }, end: { x: X + ANCHO, y: base }, thickness: 0.6, color: LINEA });
    const ty = base + 11;
    const celda = (i: number, t: string, f = normal, color = INK) => page.drawText(recortar(t, f, 8.5, COL[i] - 7), { x: xCol(i) + 4, y: ty, size: 8.5, font: f, color });
    celda(0, String(n + 1)); celda(1, String(a.legajo)); celda(2, a.nombre, bold); celda(3, a.cuil); celda(4, a.sector);
    if (realizada) celda(5, a.asistio ? "Presente" : a.asistio === false ? "Ausente" : "-", normal, a.asistio ? INK : GRIS);
    // Quien confirmó desde el portal ya firmó: se deja constancia de
    // cuándo. El resto, espacio en blanco para la firma en papel.
    if (a.firmadoEn) {
      page.drawText("Confirmó en el portal", { x: xCol(6) + 4, y: base + 17, size: 7, font: bold, color: INK });
      page.drawText(`${diaHora(a.firmadoEn)} hs`, { x: xCol(6) + 4, y: base + 7, size: 7, font: normal, color: GRIS });
    }
    y = base;
  });
  page.drawLine({ start: { x: X, y }, end: { x: X + ANCHO, y }, thickness: 0.8, color: INK });

  // Firma de quien la dictó y del responsable. Si no entra, a otra hoja.
  if (y - 95 < 30) nuevaPagina(false);
  y -= 70;
  for (const [x, texto] of [[X + 20, "Firma y aclaración de quien dictó la capacitación"], [X + 290, "Firma y aclaración del responsable de la empresa"]] as [number, string][]) {
    page.drawLine({ start: { x, y }, end: { x: x + 205, y }, thickness: 0.7, color: INK });
    page.drawText(texto, { x, y: y - 11, size: 7.5, font: normal, color: GRIS });
  }

  const paginas = doc.getPages();
  const resumen = realizada ? `${p.asistentes.filter((a) => a.asistio).length} presentes de ${p.asistentes.length} convocados - ${p.asistentes.filter((a) => a.firmadoEn).length} confirmaron en el portal` : `${p.asistentes.length} convocados`;
  paginas.forEach((pg, i) => {
    pg.drawText(limpio(resumen), { x: X, y: 25, size: 7.5, font: normal, color: GRIS });
    const t = `Hoja ${i + 1} de ${paginas.length}`;
    pg.drawText(t, { x: X + ANCHO - normal.widthOfTextAtSize(t, 7.5), y: 25, size: 7.5, font: normal, color: GRIS });
  });
  return doc.save();
}
