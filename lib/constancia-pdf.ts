// FM RRHH — lib/constancia-pdf.ts
// PDF de una constancia del legajo digital (ficha, DD.JJ. de domicilio,
// notificación de vacaciones). Un solo generador para las tres: recibe el
// mismo `Contenido` que se le mostró al empleado y que quedó guardado al
// firmar, así el papel dice exactamente lo que se firmó.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Contenido } from "./legajo-digital-reglas";

const INK = rgb(0.086, 0.227, 0.361);
const GRIS = rgb(0.35, 0.37, 0.4);

// Las fuentes estándar de PDF solo conocen Latin-1. Un emoji o una comilla
// "rara" en un domicilio hace que pdf-lib tire error y no salga el PDF.
const limpio = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA1-\xFF]/g, "?");

function partir(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of limpio(texto).split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(prueba, size) > ancho && actual) {
      lineas.push(actual);
      actual = palabra;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [""];
}

export interface FirmaConstancia { firmante: string; firmadoEn: Date; ip: string | null; hash: string }

export async function generarConstanciaPDF(contenido: Contenido, firma: FirmaConstancia | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const X = 50, ANCHO = 495;
  let y = 790;

  page.drawText(limpio(contenido.titulo), { x: X, y, size: 14, font: bold, color: INK });
  y -= 14;
  page.drawLine({ start: { x: X, y }, end: { x: X + ANCHO, y }, thickness: 1.2, color: INK });
  y -= 24;

  for (const seccion of contenido.secciones) {
    if (seccion.titulo) {
      page.drawText(limpio(seccion.titulo).toUpperCase(), { x: X, y, size: 8.5, font: bold, color: GRIS });
      y -= 16;
    }
    for (const [label, valor] of seccion.filas) {
      page.drawText(limpio(label) + ":", { x: X, y, size: 10, font: bold, color: INK });
      for (const linea of partir(valor || "-", normal, 10, ANCHO - 150)) {
        page.drawText(linea, { x: X + 150, y, size: 10, font: normal, color: INK });
        y -= 15;
      }
      y -= 3;
    }
    y -= 10;
  }

  y -= 6;
  for (const linea of partir(contenido.declaracion, normal, 10, ANCHO)) {
    page.drawText(linea, { x: X, y, size: 10, font: normal, color: INK });
    y -= 15;
  }
  y -= 28;

  if (firma) {
    const cuando = firma.firmadoEn.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" });
    page.drawRectangle({ x: X, y: y - 62, width: ANCHO, height: 74, borderColor: INK, borderWidth: 0.8 });
    page.drawText("FIRMADO ELECTRÓNICAMENTE", { x: X + 12, y: y - 6, size: 9, font: bold, color: INK });
    page.drawText(limpio(`${firma.firmante} - ${cuando} hs (Argentina)`), { x: X + 12, y: y - 22, size: 10, font: normal, color: INK });
    page.drawText(limpio(`Confirmado con PIN personal en el portal del empleado${firma.ip ? ` - IP ${firma.ip}` : ""}`), { x: X + 12, y: y - 37, size: 8.5, font: normal, color: GRIS });
    page.drawText(`Huella del contenido (SHA-256): ${firma.hash}`, { x: X + 12, y: y - 51, size: 7, font: normal, color: GRIS });
  } else {
    page.drawText("SIN FIRMAR - vista previa", { x: X, y, size: 10, font: bold, color: rgb(0.7, 0.23, 0.23) });
  }
  return doc.save();
}
