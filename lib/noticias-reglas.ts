// FM RRHH — lib/noticias-reglas.ts
// Reglas de las noticias — funciones puras (tests/noticias-reglas.test.mjs).

export const MAX_TITULO = 120;
export const MAX_CUERPO = 5000;

export function validarNoticia(titulo: unknown, cuerpo: unknown): string | null {
  const t = String(titulo ?? "").trim();
  const c = String(cuerpo ?? "").trim();
  if (t.length < 3) return "Poné un título.";
  if (t.length > MAX_TITULO) return `El título no puede pasar de ${MAX_TITULO} caracteres.`;
  if (c.length < 10) return "Escribí el texto de la noticia.";
  if (c.length > MAX_CUERPO) return `El texto no puede pasar de ${MAX_CUERPO} caracteres. Si es más largo, adjuntalo como PDF.`;
  return null;
}

// ¿Le corresponde esta noticia a este empleado? Misma empresa, publicada,
// y dirigida a toda la empresa o a SU sector. Es la única definición de
// "destinatario": la usan el portal (qué ve) y el panel (a quién se cuenta).
export function esDestinatario(
  noticia: { empresaId: string; estado: string; centroCostoId: string | null },
  legajo: { empresaId: string; centroCostoId: string | null }
): boolean {
  if (noticia.estado !== "publicada" || noticia.empresaId !== legajo.empresaId) return false;
  return noticia.centroCostoId === null || noticia.centroCostoId === legajo.centroCostoId;
}

// Qué le falta hacer al empleado con una noticia.
//   'nueva'           no la abrió
//   'falta_acuse'     la abrió, pide acuse y no lo dio
//   'al_dia'          nada pendiente
export type EstadoLectura = "nueva" | "falta_acuse" | "al_dia";
export function estadoLectura(requiereAcuse: boolean, lectura: { acuseEn: Date | string | null } | null | undefined): EstadoLectura {
  if (!lectura) return "nueva";
  if (requiereAcuse && !lectura.acuseEn) return "falta_acuse";
  return "al_dia";
}

// Números para RR.HH. Solo cuentan lecturas de quienes HOY son
// destinatarios: si alguien la leyó y después se fue de la empresa o
// cambió de sector, no infla el porcentaje.
export function estadisticas(destinatarios: string[], lecturas: { legajoId: string; acuseEn: Date | string | null }[]) {
  const dest = new Set(destinatarios);
  const propias = lecturas.filter((l) => dest.has(l.legajoId));
  return { destinatarios: dest.size, leyeron: propias.length, acusaron: propias.filter((l) => l.acuseEn).length };
}

export function resumenCuerpo(cuerpo: string, max = 110): string {
  const plano = cuerpo.replace(/\s+/g, " ").trim();
  return plano.length <= max ? plano : plano.slice(0, max).replace(/\s+\S*$/, "") + "…";
}
