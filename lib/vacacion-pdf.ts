// FM RRHH — lib/vacacion-pdf.ts
// Mismo enfoque que lib/recibo-pdf.ts: Node + pdf-lib, probado y corregido
// (un glitch de superposición de texto) antes de portarlo acá.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const INK = rgb(0.086, 0.227, 0.361);

interface DatosNotificacion {
  empresa: { razonSocial: string; cuit: string };
  legajo: { numero: number; apellido: string; nombre: string; cuil: string };
  periodo: { anioCorresponde: number; diasCorresponden: number; fechaDesde: string; fechaHasta: string };
}

export async function generarNotificacionVacacionesPDF({ empresa, legajo, periodo }: DatosNotificacion): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 500]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);

  let y = 440;
  const marginX = 50;

  page.drawText("NOTIFICACIÓN DE OTORGAMIENTO DE VACACIONES", { x: marginX, y, size: 14, font: bold, color: INK });
  y -= 20;
  page.drawText(`${empresa.razonSocial} — CUIT ${empresa.cuit}`, { x: marginX, y, size: 9, font: normal, color: INK });
  y -= 25;
  page.drawLine({ start: { x: marginX, y }, end: { x: 545, y }, thickness: 1.2, color: INK });
  y -= 25;

  const fila = (label: string, valor: string | number) => {
    page.drawText(label, { x: marginX, y, size: 10, font: bold, color: INK });
    page.drawText(String(valor), { x: marginX + 160, y, size: 10, font: normal, color: INK });
    y -= 20;
  };
  fila("Legajo:", legajo.numero);
  fila("Apellido y Nombre:", `${legajo.apellido}, ${legajo.nombre}`);
  fila("CUIL:", legajo.cuil);
  y -= 10;
  fila("Año que corresponde:", periodo.anioCorresponde);
  fila("Días que corresponden:", `${periodo.diasCorresponden} días corridos`);
  fila("Fecha de inicio:", periodo.fechaDesde);
  fila("Fecha de finalización:", periodo.fechaHasta);
  y -= 20;

  page.drawText(
    "De conformidad con lo dispuesto por el Art. 154 de la Ley de Contrato de Trabajo, se notifica al",
    { x: marginX, y, size: 9, font: normal, color: INK }
  );
  y -= 13;
  page.drawText(
    "trabajador el otorgamiento del período vacacional indicado, con la antelación legal correspondiente.",
    { x: marginX, y, size: 9, font: normal, color: INK }
  );
  y -= 60;

  page.drawLine({ start: { x: marginX, y }, end: { x: marginX + 220, y }, thickness: 0.6, color: INK });
  page.drawText("Firma del empleador", { x: marginX, y: y - 14, size: 8, font: normal, color: INK });

  page.drawLine({ start: { x: 320, y }, end: { x: 540, y }, thickness: 0.6, color: INK });
  page.drawText("Firma del trabajador (recibido conforme)", { x: 320, y: y - 14, size: 8, font: normal, color: INK });

  return doc.save();
}
