// FM RRHH — lib/epp-pdf.ts
// La constancia de entrega de ropa de trabajo y elementos de protección
// personal de UN trabajador, con los datos y las columnas del formulario de
// la Resolución SRT 299/11. Sale con todo su historial: las entregas que
// confirmó desde el portal figuran con fecha y hora; las demás tienen el
// lugar para firmar de puño y letra.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const INK = rgb(0.086, 0.227, 0.361), GRIS = rgb(0.35, 0.37, 0.4), LINEA = rgb(0.6, 0.64, 0.68);
// Las fuentes estándar de PDF solo conocen Latin-1.
const limpio = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA1-\xFF]/g, "?");
function recortar(texto: string, font: PDFFont, size: number, ancho: number): string {
  let t = limpio(texto);
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > ancho) t = t.slice(0, -2) + ".";
  return t;
}
const dia = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const diaHora = (d: Date) => d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" });

export interface ConstanciaEpp {
  empresa: string; cuit: string; domicilio: string | null;
  trabajador: string; dni: string; legajo: number; puesto: string | null; sector: string | null;
  necesarios: string[]; // lo que le corresponde según su puesto
  entregas: { producto: string; tipoModelo: string | null; marca: string | null; certificado: boolean; cantidad: number; talle: string | null; fechaEntrega: Date; firmadoEn: Date | null; enPapel: boolean }[];
}

export async function generarConstanciaEppPDF(c: ConstanciaEpp): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  // Apaisado: la tabla tiene ocho columnas.
  const W = 842, H = 595, X = 36, ANCHO = W - 2 * X, FILA = 26, PIE = 70;
  // n° · producto · tipo/modelo · marca · certificación · cantidad · fecha · firma
  const COL = [24, 170, 150, 100, 62, 50, 70, 144];
  const TIT = ["N°", "Producto", "Tipo / Modelo", "Marca", "Posee certif.", "Cantidad", "Fecha entrega", "Firma del trabajador"];
  const xCol = (i: number) => X + COL.slice(0, i).reduce((a, b) => a + b, 0);
  let page!: PDFPage, y = 0;

  const encabezadoTabla = () => {
    page.drawRectangle({ x: X, y: y - 6, width: ANCHO, height: 18, color: INK });
    TIT.forEach((t, i) => page.drawText(t, { x: xCol(i) + 4, y, size: 8, font: bold, color: rgb(1, 1, 1) }));
    y -= 6;
  };
  const nuevaPagina = (primera: boolean) => {
    page = doc.addPage([W, H]);
    y = H - 40;
    page.drawText("CONSTANCIA DE ENTREGA DE ROPA DE TRABAJO Y ELEMENTOS DE PROTECCIÓN PERSONAL", { x: X, y, size: 12, font: bold, color: INK });
    const res = primera ? "Resolución SRT 299/11" : "(continuación)";
    page.drawText(res, { x: X + ANCHO - normal.widthOfTextAtSize(res, 9), y, size: 9, font: normal, color: GRIS });
    y -= 8;
    page.drawLine({ start: { x: X, y }, end: { x: X + ANCHO, y }, thickness: 1.2, color: INK });
    y -= 18;
  };
  const par = (x: number, label: string, valor: string, ancho: number) => {
    page.drawText(label, { x, y, size: 9, font: bold, color: INK });
    const w = bold.widthOfTextAtSize(label, 9) + 5;
    page.drawText(recortar(valor || "-", normal, 9, ancho - w), { x: x + w, y, size: 9, font: normal, color: INK });
  };

  nuevaPagina(true);
  par(X, "Razón social:", c.empresa, 480); par(X + 500, "CUIT:", c.cuit, 270); y -= 15;
  par(X, "Dirección:", c.domicilio ?? "", ANCHO); y -= 15;
  par(X, "Nombre y apellido del trabajador:", c.trabajador, 480); par(X + 500, "DNI:", c.dni, 130); par(X + 640, "Legajo:", String(c.legajo), 130); y -= 15;
  par(X, "Descripción breve del puesto de trabajo:", [c.puesto, c.sector].filter(Boolean).join(" - "), ANCHO); y -= 15;
  par(X, "Elementos de protección personal necesarios según el puesto:", c.necesarios.join(", ") || "(sin definir en el sistema)", ANCHO); y -= 24;
  encabezadoTabla();

  const filas = c.entregas.length ? c.entregas : [];
  // Siempre quedan renglones en blanco al final, para entregas a mano.
  const enBlanco = Math.max(4, 10 - filas.length);
  const total = filas.length + enBlanco;
  for (let i = 0; i < total; i++) {
    if (y - FILA < PIE) { nuevaPagina(false); encabezadoTabla(); }
    y -= FILA;
    const e = filas[i];
    page.drawLine({ start: { x: X, y }, end: { x: X + ANCHO, y }, thickness: 0.6, color: LINEA });
    COL.forEach((_, k) => page.drawLine({ start: { x: xCol(k), y }, end: { x: xCol(k), y: y + FILA }, thickness: 0.6, color: LINEA }));
    page.drawLine({ start: { x: X + ANCHO, y }, end: { x: X + ANCHO, y: y + FILA }, thickness: 0.6, color: LINEA });
    const t = (k: number, s: string, f = normal) => page.drawText(recortar(s, f, 8.5, COL[k] - 8), { x: xCol(k) + 4, y: y + 9, size: 8.5, font: f, color: INK });
    t(0, String(i + 1));
    if (!e) continue;
    t(1, e.producto + (e.talle ? ` (talle ${e.talle})` : ""));
    t(2, e.tipoModelo ?? ""); t(3, e.marca ?? ""); t(4, e.certificado ? "SI" : "NO"); t(5, String(e.cantidad)); t(6, dia(e.fechaEntrega));
    if (e.firmadoEn) {
      page.drawText("Conforme - desde el portal", { x: xCol(7) + 4, y: y + 14, size: 7.5, font: bold, color: INK });
      page.drawText(diaHora(e.firmadoEn), { x: xCol(7) + 4, y: y + 5, size: 7.5, font: normal, color: GRIS });
    }
  }

  // El pie va en la última página.
  if (y < PIE + 30) nuevaPagina(false);
  page.drawText(limpio("Las entregas que figuran como \"Conforme - desde el portal\" fueron confirmadas por el trabajador con su usuario y clave personal; queda registrado el día, la hora y desde dónde."), { x: X, y: 52, size: 7.5, font: normal, color: GRIS });
  page.drawText(limpio(`Emitida el ${dia(new Date())}. Información adicional: ______________________________________________________________________________________`), { x: X, y: 38, size: 7.5, font: normal, color: GRIS });
  return doc.save();
}
