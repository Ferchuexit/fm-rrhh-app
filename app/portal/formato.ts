// Formatos de pantalla del portal.
export const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

// Fechas de período: se guardan como medianoche UTC, se muestran en UTC
// (si no, en Argentina "1 de agosto" se ve como "31 de julio").
export const fechaPeriodo = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

// Momentos reales (cuándo firmó): hora de Argentina.
export const fechaHora = (d: Date) =>
  d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" });

export function estadoFirma(firma: string | null | undefined): { clase: string; texto: string } {
  if (firma === "conforme") return { clase: "conforme", texto: "Firmado" };
  if (firma === "disconforme") return { clase: "disconforme", texto: "Firmado en disconformidad" };
  return { clase: "pendiente", texto: "Falta firmar" };
}
