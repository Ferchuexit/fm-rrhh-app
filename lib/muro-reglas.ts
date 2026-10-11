// FM RRHH — lib/muro-reglas.ts
// Publicaciones del muro: lo que la gente comparte (un texto, una foto).
// Funciones puras (tests/muro-reglas.test.mjs).

export const MAX_TEXTO_PUBLICACION = 1500;
export const MAX_COMENTARIO = 500;
export const MAX_FOTO_BYTES = 4 * 1024 * 1024; // el límite de subida de Vercel es 4,5 MB
export const MAX_PUBLICACIONES_POR_DIA = 5;
export const FOTOS_ACEPTADAS = ["image/jpeg", "image/png", "image/webp"];

const limpio = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, max) : "");

// `deHoy`: cuántas publicó hoy esa persona (null = publica RR.HH., sin tope).
export function validarPublicacion(textoCrudo: unknown, conFoto: boolean, deHoy: number | null): { texto: string; error: string | null } {
  const texto = limpio(textoCrudo, MAX_TEXTO_PUBLICACION);
  if (deHoy !== null && deHoy >= MAX_PUBLICACIONES_POR_DIA) return { texto, error: `Ya publicaste ${MAX_PUBLICACIONES_POR_DIA} veces hoy. Mañana podés seguir.` };
  if (!conFoto && texto.length < 3) return { texto, error: "Escribí algo o sumá una foto." };
  return { texto, error: null };
}

// La foto: por lo que ES (los primeros bytes), no por lo que dice el nombre.
export function motivoFotoInvalida(bytes: number, mimeReal: string | null): string | null {
  if (bytes > MAX_FOTO_BYTES) return "La foto pesa más de 4 MB. Probá con una más liviana.";
  if (!mimeReal || !FOTOS_ACEPTADAS.includes(mimeReal)) return "El archivo tiene que ser una foto (JPG, PNG o WebP).";
  return null;
}

export const limpiarComentario = (v: unknown): string | null => limpio(v, MAX_COMENTARIO) || null;

// ¿La ve esta persona en el muro? Lo que espera aprobación lo ve solo su
// autor (con el cartel de "pendiente").
export const visibleEnMuro = (p: { oculto: boolean; pendiente: boolean; autorId: string | null }, legajoId: string) => !p.oculto && (!p.pendiente || p.autorId === legajoId);

// El muro mezcla reconocimientos y publicaciones, lo más nuevo arriba.
export function mezclar<A extends { createdAt: Date }, B extends { createdAt: Date }>(reconocimientos: A[], publicaciones: B[], tope: number): ({ tipo: "reconocimiento"; item: A } | { tipo: "publicacion"; item: B })[] {
  return [...reconocimientos.map((item) => ({ tipo: "reconocimiento" as const, item })), ...publicaciones.map((item) => ({ tipo: "publicacion" as const, item }))].sort((a, b) => b.item.createdAt.getTime() - a.item.createdAt.getTime()).slice(0, tope);
}
