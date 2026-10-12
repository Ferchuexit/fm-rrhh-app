// FM RRHH — lib/banco-horas-pdf.ts
// El acuerdo escrito de banco de horas (art. 197 bis LCT, Ley 27.802) en
// PDF: lo que el empleado lee antes de aceptarlo en el portal, o lo que se
// imprime y se firma. Es un MODELO: la pantalla avisa que conviene
// revisarlo con el asesor legal y contra el convenio colectivo.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { EQUIVALENCIAS } from "./banco-horas-reglas";

const INK = rgb(0.086, 0.227, 0.361), GRIS = rgb(0.35, 0.37, 0.4), LINEA = rgb(0.6, 0.64, 0.68);
const limpio = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA1-\xFF]/g, "?");
const dia = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const diaHora = (d: Date) => d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" });

export interface DatosAcuerdo {
  empresa: string; cuit: string; domicilio: string | null;
  trabajador: string; cuil: string; legajo: number; puesto: string | null;
  desde: Date; hasta: Date | null; origen: string; topeHoras: number | null; plazoDias: number | null; equivalencia: string; observaciones: string | null;
  aceptadoEn: Date | null; aceptadoIp: string | null; finalizadoEn: Date | null;
}

export function clausulas(a: DatosAcuerdo): [string, string][] {
  const equiv = a.equivalencia === "simple"
    ? "Cada hora extra trabajada se acredita como una hora de descanso (hora por hora)."
    : "Cada hora extra trabajada se acredita con su recargo: una hora con recargo del 50 % equivale a una hora y treinta minutos de descanso, y una hora con recargo del 100 %, a dos horas de descanso.";
  return [
    ["Objeto", `${a.origen === "sindical" ? "Con la intervención de la representación sindical en la empresa, las" : "Las"} partes acuerdan en forma voluntaria, en los términos del artículo 197 bis de la Ley de Contrato de Trabajo (texto según Ley 27.802), un régimen de compensación de horas extraordinarias mediante un banco de horas.`],
    ["Voluntariedad", "La realización de horas extraordinarias es voluntaria para el trabajador, salvo los casos de excepción previstos por la ley (peligro grave, accidente o fuerza mayor). Negarse a realizarlas no genera ninguna sanción ni consecuencia."],
    ["Acumulación", `${equiv}${a.topeHoras ? ` El banco no puede superar ${a.topeHoras} horas acumuladas: las horas que excedan ese tope se pagan como horas extraordinarias en la liquidación del mes.` : ""}`],
    ["Compensación", "Las horas acumuladas se compensan con francos o con reducción de la jornada en otros días, en fechas acordadas entre las partes. La mayor jornada de un día puede compensarse con la menor de otro."],
    ["Plazo", a.plazoDias ? `Cada hora acumulada debe compensarse dentro de los ${a.plazoDias} días de generada. Si no se compensa en ese plazo, se paga con el recargo del artículo 201 de la Ley de Contrato de Trabajo en la liquidación siguiente.` : "Las horas acumuladas no tienen un plazo fijo para compensarse."],
    ["Opción de cobro", "El trabajador puede pedir en cualquier momento que se le paguen, en lugar de compensarse, las horas que tenga acumuladas, con el recargo que corresponda a cada una."],
    ["Descansos y límites", "En todos los casos se respetan el descanso mínimo de doce (12) horas entre jornadas, el descanso semanal de treinta y cinco (35) horas, la jornada máxima legal o convencional y los topes de horas extraordinarias vigentes."],
    ["Control", "Las horas trabajadas, acumuladas, compensadas y pagadas se registran en el sistema de gestión de la empresa a partir de las fichadas. El trabajador puede consultar su saldo y cada movimiento en todo momento desde el portal del empleado, y pedir la corrección de lo que no coincida."],
    ["Extinción del contrato", "Si la relación laboral termina por cualquier causa, las horas acumuladas y no compensadas se pagan con su recargo en la liquidación final."],
    ["Vigencia", `Rige desde el ${dia(a.desde)}${a.hasta ? ` hasta el ${dia(a.hasta)}` : " por tiempo indeterminado"}. Cualquiera de las partes puede dejarlo sin efecto hacia adelante, avisándolo por escrito; las horas acumuladas hasta ese momento se compensan o se pagan.`],
    ...(a.observaciones ? [["Condiciones particulares", a.observaciones] as [string, string]] : []),
  ];
}

function partir(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const out: string[] = [];
  for (const parrafo of limpio(texto).split("\n")) {
    let linea = "";
    for (const palabra of parrafo.split(/\s+/)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, size) > ancho && linea) { out.push(linea); linea = palabra; } else linea = prueba;
    }
    out.push(linea);
  }
  return out;
}

export async function generarAcuerdoBancoHorasPDF(a: DatosAcuerdo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842, X = 56, ANCHO = W - 2 * X;
  let page!: PDFPage, y = 0;
  const nueva = () => { page = doc.addPage([W, H]); y = H - 56; };
  const lugar = (alto: number) => { if (y - alto < 60) nueva(); };
  const texto = (t: string, size: number, font: PDFFont, color = INK, sangria = 0) => {
    for (const l of partir(t, font, size, ANCHO - sangria)) { lugar(size + 4); page.drawText(l, { x: X + sangria, y, size, font, color }); y -= size + 4; }
  };

  nueva();
  texto("ACUERDO DE BANCO DE HORAS", 15, bold);
  texto("Régimen de compensación de horas extraordinarias - art. 197 bis LCT (Ley 27.802)", 9.5, normal, GRIS);
  y -= 4;
  page.drawLine({ start: { x: X, y }, end: { x: X + ANCHO, y }, thickness: 1.2, color: INK });
  y -= 18;
  texto(`Empleador: ${a.empresa} - CUIT ${a.cuit}${a.domicilio ? ` - ${a.domicilio}` : ""}`, 10, normal);
  texto(`Trabajador: ${a.trabajador} - CUIL ${a.cuil} - Legajo ${a.legajo}${a.puesto ? ` - ${a.puesto}` : ""}`, 10, normal);
  texto(`Equivalencia: ${EQUIVALENCIAS[a.equivalencia] ?? a.equivalencia}`, 10, normal);
  y -= 8;

  clausulas(a).forEach(([titulo, cuerpo], i) => {
    lugar(40);
    texto(`${i + 1}. ${titulo}`, 10.5, bold);
    texto(cuerpo, 10, normal, rgb(0.12, 0.16, 0.2));
    y -= 6;
  });

  y -= 10;
  lugar(110);
  if (a.aceptadoEn) {
    page.drawRectangle({ x: X, y: y - 46, width: ANCHO, height: 56, borderColor: INK, borderWidth: 1 });
    y -= 8;
    texto(`Aceptado por el trabajador desde el portal del empleado el ${diaHora(a.aceptadoEn)}${a.aceptadoIp ? ` (IP ${a.aceptadoIp})` : ""}.`, 10, bold, INK, 10);
    texto("La aceptación quedó registrada con fecha, hora y origen en el sistema de gestión de la empresa.", 9, normal, GRIS, 10);
    y -= 20;
  } else {
    y -= 40;
    const firma = (x: number, etiqueta: string) => {
      page.drawLine({ start: { x, y }, end: { x: x + 200, y }, thickness: 0.8, color: LINEA });
      page.drawText(etiqueta, { x, y: y - 12, size: 9, font: normal, color: GRIS });
      page.drawText("Aclaración y fecha:", { x, y: y - 26, size: 9, font: normal, color: GRIS });
    };
    firma(X, "Firma del trabajador");
    firma(X + ANCHO - 200, "Firma del empleador");
    y -= 46;
  }
  if (a.finalizadoEn) texto(`Este acuerdo quedó sin efecto desde el ${dia(a.finalizadoEn)}.`, 10, bold, rgb(0.7, 0.15, 0.15));
  const pie = `Emitido el ${diaHora(new Date())}`;
  for (const p of doc.getPages()) p.drawText(pie, { x: X, y: 30, size: 8, font: normal, color: GRIS });
  return doc.save();
}
