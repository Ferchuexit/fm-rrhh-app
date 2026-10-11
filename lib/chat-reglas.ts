// FM RRHH — lib/chat-reglas.ts
// Chat interno y grupos: quién ve cada conversación, quién puede escribir
// y a quién se le avisa. Funciones puras (tests/chat-reglas.test.mjs).

export const MAX_TEXTO = 2000;
export const TIPOS = ["grupo", "rrhh", "directo"] as const;

// El texto de un mensaje, limpio; null si quedó vacío.
export function limpiarTexto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r/g, "").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, MAX_TEXTO);
  return t || null;
}

export const claveRRHH = (legajoId: string) => `rrhh|${legajoId}`;
// La misma para los dos, la abra quien la abra.
export const claveDirecta = (a: string, b: string) => `dm|${[a, b].sort().join("|")}`;
export const participantesDe = (clave: string | null) => (clave?.startsWith("dm|") ? clave.split("|").slice(1) : []);

export interface DatosGrupo { nombre: string; descripcion: string | null; emoji: string; todos: boolean; centroCostoIds: string[]; soloAnuncios: boolean }
export function validarGrupo(entrada: any): { datos: DatosGrupo | null; error: string | null } {
  const nombre = String(entrada?.nombre ?? "").trim().slice(0, 60);
  if (nombre.length < 3) return { datos: null, error: "Ponele un nombre al grupo (por ejemplo: Taller, Brigada de emergencia)." };
  const todos = entrada?.todos === true;
  const emoji = [...String(entrada?.emoji ?? "").trim()].slice(0, 2).join("") || "💬";
  return { datos: { nombre, descripcion: String(entrada?.descripcion ?? "").trim().slice(0, 300) || null, emoji, todos, centroCostoIds: todos ? [] : [...new Set<string>((Array.isArray(entrada?.centroCostoIds) ? entrada.centroCostoIds : []).map(String))], soloAnuncios: entrada?.soloAnuncios === true }, error: null };
}

type Conv = { tipo: string; todos: boolean; centroCostoIds: string[]; soloAnuncios: boolean; empleadoId: string | null; clave: string | null; archivada: boolean };
type Persona = { id: string; centroCostoId: string | null };
type Fila = { agregado: boolean; admin: boolean } | null | undefined;

// ¿Esta persona es parte de la conversación?
//   grupo   → es de toda la empresa, de su sector, o la agregaron a mano
//   rrhh    → es SU consulta
//   directo → es uno de los dos
export function participa(c: Conv, p: Persona, fila: Fila): boolean {
  if (c.tipo === "rrhh") return c.empleadoId === p.id;
  if (c.tipo === "directo") return participantesDe(c.clave).includes(p.id);
  if (c.tipo !== "grupo") return false;
  return c.todos || (p.centroCostoId !== null && c.centroCostoIds.includes(p.centroCostoId)) || fila?.agregado === true;
}
// Un grupo archivado deja de verse; una charla directa o con RR.HH. no se archiva.
export const puedeVer = (c: Conv, p: Persona, fila: Fila) => participa(c, p, fila) && !(c.tipo === "grupo" && c.archivada);

// Por qué un EMPLEADO no puede escribir (null si puede). RR.HH. desde el
// panel escribe siempre, salvo en un grupo archivado.
export function motivoNoEscribir(c: Conv, p: Persona, fila: Fila, directosHabilitados: boolean): string | null {
  if (!puedeVer(c, p, fila)) return "No sos parte de esta conversación.";
  if (c.tipo === "grupo" && c.soloAnuncios && fila?.admin !== true) return "En este grupo solo escriben RR.HH. y los encargados.";
  if (c.tipo === "directo" && !directosHabilitados) return "La empresa desactivó los mensajes entre compañeros. Podés escribirle a RR.HH.";
  return null;
}

// ¿Se le manda la notificación? Solo si estaba al día: quien ya tiene
// mensajes sin leer de esa conversación no recibe una notificación por
// cada mensaje nuevo. `leidoHasta`: hasta dónde leyó (null = nunca la
// abrió); `anterior`: cuándo fue el mensaje anterior a este (null = es el
// primero).
export function tocaNotificar(leidoHasta: Date | null, anterior: Date | null): boolean {
  if (!anterior) return true;
  return leidoHasta !== null && leidoHasta >= anterior;
}

// El renglón de vista previa de la lista.
export const vistaPrevia = (autor: string, texto: string, conAutor: boolean) => `${conAutor ? `${autor.split(" ")[0]}: ` : ""}${texto.replace(/\s+/g, " ")}`.slice(0, 90);
