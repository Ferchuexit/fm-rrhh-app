// FM RRHH — lib/reclutamiento-filtros.ts
// Filtros de preselección de una búsqueda: preguntas que responde el
// candidato y palabras clave que se buscan en su CV. Funciones puras, sin
// base de datos (tests/reclutamiento-filtros.test.mjs).
//
// CRITERIO: el filtro ORDENA y MARCA, nunca descarta solo. Un "no cumple"
// puede ser un error de tipeo o un CV escaneado sin texto; la decisión de
// dejar a alguien afuera la toma una persona, que ve por qué quedó abajo.
// Y es transparente: el puntaje se explica pregunta por pregunta.

export type TipoFiltro = "si_no" | "opcion" | "numero";
export interface PreguntaFiltro {
  texto: string;
  tipo: TipoFiltro;
  excluyente: boolean; // si no la cumple, queda marcado como "no cumple"
  puntos: number; // 1 deseable · 2 importante · 3 muy importante
  esperado?: "si" | "no"; // si_no: la respuesta que suma
  opciones?: string[]; // opcion
  aceptadas?: number[]; // opcion: cuáles suman
  minimo?: number; // numero: desde cuánto suma (años de experiencia)
}
export type RespuestasFiltro = Record<string, string | number>;

export const TIPOS_FILTRO: Record<TipoFiltro, string> = { si_no: "Sí / No", opcion: "Elegir una opción", numero: "Un número (años, cantidad)" };
export const PESOS: Record<number, string> = { 1: "Deseable", 2: "Importante", 3: "Muy importante" };
export const MAX_PREGUNTAS_FILTRO = 10;
export const MAX_PALABRAS = 20;
// Desde este puntaje (y cumpliendo los excluyentes) alguien es "finalista
// sugerido".
export const UMBRAL_FINALISTA = 70;

export function limpiarFiltros(entrada: unknown): { preguntas: PreguntaFiltro[]; error: string | null } {
  if (entrada === undefined || entrada === null) return { preguntas: [], error: null };
  if (!Array.isArray(entrada)) return { preguntas: [], error: "Las preguntas de filtro no llegaron bien." };
  if (entrada.length > MAX_PREGUNTAS_FILTRO) return { preguntas: [], error: `Hasta ${MAX_PREGUNTAS_FILTRO} preguntas de filtro: con más, la gente abandona el formulario.` };
  const preguntas: PreguntaFiltro[] = [];
  for (const [i, p] of entrada.entries()) {
    const texto = String(p?.texto ?? "").trim().slice(0, 200);
    if (texto.length < 5) return { preguntas: [], error: `A la pregunta de filtro ${i + 1} le falta el texto.` };
    const tipo = p?.tipo as TipoFiltro;
    if (!(tipo in TIPOS_FILTRO)) return { preguntas: [], error: `Elegí el tipo de la pregunta de filtro ${i + 1}.` };
    const puntos = [1, 2, 3].includes(Number(p?.puntos)) ? Number(p.puntos) : 1;
    const base = { texto, tipo, excluyente: p?.excluyente === true, puntos };
    if (tipo === "si_no") preguntas.push({ ...base, esperado: p?.esperado === "no" ? "no" : "si" });
    else if (tipo === "numero") {
      const minimo = Number(p?.minimo);
      if (!Number.isFinite(minimo) || minimo < 0 || minimo > 1000) return { preguntas: [], error: `En «${texto}», poné desde qué número suma (por ejemplo, 2 años).` };
      preguntas.push({ ...base, minimo });
    } else {
      const opciones = [...new Set((Array.isArray(p?.opciones) ? p.opciones : []).map((o: unknown) => String(o ?? "").trim().slice(0, 80)).filter(Boolean))] as string[];
      if (opciones.length < 2 || opciones.length > 8) return { preguntas: [], error: `«${texto}» necesita entre 2 y 8 opciones.` };
      const aceptadas = [...new Set((Array.isArray(p?.aceptadas) ? p.aceptadas : []).map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n < opciones.length))] as number[];
      if (aceptadas.length === 0) return { preguntas: [], error: `En «${texto}», marcá qué opciones suman.` };
      preguntas.push({ ...base, opciones, aceptadas });
    }
  }
  return { preguntas, error: null };
}

// "autoelevador, CNC, seccionadora" → lista limpia, sin repetir.
export function limpiarPalabras(entrada: unknown): string[] {
  const lista = Array.isArray(entrada) ? entrada : String(entrada ?? "").split(/[,;\n]/);
  const vistas = new Set<string>();
  const palabras: string[] = [];
  for (const p of lista) {
    const t = String(p ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (t.length < 2 || vistas.has(normalizar(t))) continue;
    vistas.add(normalizar(t));
    palabras.push(t);
    if (palabras.length === MAX_PALABRAS) break;
  }
  return palabras;
}

// Para comparar: minúsculas y sin tildes ("Soldadúra" = "soldadura").
export const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Lo que respondió el candidato → respuestas válidas para ESAS preguntas.
// `obligatorias`: en el formulario de postulación hay que responder todas.
export function limpiarRespuestasFiltro(preguntas: PreguntaFiltro[], entrada: unknown, obligatorias: boolean): { respuestas: RespuestasFiltro; error: string | null } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const respuestas: RespuestasFiltro = {};
  for (const [i, p] of preguntas.entries()) {
    const v = e[String(i)];
    const vacio = v === undefined || v === null || v === "";
    let valor: string | number | null = null;
    if (!vacio) {
      if (p.tipo === "si_no") valor = v === "si" || v === "no" ? v : null;
      else if (p.tipo === "numero") { const n = Number(String(v).replace(",", ".")); valor = Number.isFinite(n) && n >= 0 && n <= 1000 ? n : null; }
      else { const n = Number(v); valor = Number.isInteger(n) && n >= 0 && n < (p.opciones?.length ?? 0) ? n : null; }
    }
    if (valor === null) {
      if (obligatorias || !vacio) return { respuestas: {}, error: `Falta responder: «${p.texto}»` };
      continue;
    }
    respuestas[i] = valor;
  }
  return { respuestas, error: null };
}

const cumple = (p: PreguntaFiltro, v: string | number | undefined): boolean => {
  if (v === undefined) return false;
  if (p.tipo === "si_no") return v === p.esperado;
  if (p.tipo === "numero") return Number(v) >= (p.minimo ?? 0);
  return (p.aceptadas ?? []).includes(Number(v));
};

export interface ResultadoFiltro { puntajeFiltro: number | null; cumpleExcluyentes: boolean | null; noCumple: string[]; palabrasHalladas: string[] }

// El puntaje: de todos los puntos en juego (cada pregunta los suyos, cada
// palabra clave 1), qué porcentaje sumó. Sin filtros, o si el candidato no
// respondió nada (cargado a mano) y no hay texto donde buscar: sin evaluar.
export function evaluar(preguntas: PreguntaFiltro[], palabras: string[], respuestas: RespuestasFiltro | null, texto: string | null): ResultadoFiltro {
  const sinRespuestas = !respuestas || Object.keys(respuestas).length === 0;
  const dondeBuscar = normalizar(texto ?? "");
  const palabrasHalladas = dondeBuscar ? palabras.filter((p) => dondeBuscar.includes(normalizar(p))) : [];
  const hayPreguntas = preguntas.length > 0 && !sinRespuestas;
  const hayPalabras = palabras.length > 0 && !!dondeBuscar;
  if (!hayPreguntas && !hayPalabras) return { puntajeFiltro: null, cumpleExcluyentes: null, noCumple: [], palabrasHalladas };

  let total = 0, sumados = 0;
  const noCumple: string[] = [];
  if (hayPreguntas) {
    for (const [i, p] of preguntas.entries()) {
      total += p.puntos;
      if (cumple(p, respuestas![String(i)])) sumados += p.puntos;
      else if (p.excluyente) noCumple.push(p.texto);
    }
  }
  if (hayPalabras) { total += palabras.length; sumados += palabrasHalladas.length; }
  return { puntajeFiltro: total ? Math.round((sumados / total) * 100) : null, cumpleExcluyentes: hayPreguntas ? noCumple.length === 0 : null, noCumple, palabrasHalladas };
}

// Cómo se lee una respuesta, y si suma — para mostrar el porqué del puntaje.
export function detalleRespuestas(preguntas: PreguntaFiltro[], respuestas: RespuestasFiltro | null) {
  return preguntas.map((p, i) => {
    const v = respuestas?.[String(i)];
    const texto = v === undefined ? "sin responder" : p.tipo === "si_no" ? (v === "si" ? "Sí" : "No") : p.tipo === "numero" ? String(v).replace(".", ",") : p.opciones?.[Number(v)] ?? "?";
    return { pregunta: p.texto, respuesta: texto, cumple: cumple(p, v), excluyente: p.excluyente, puntos: p.puntos };
  });
}

// ¿Finalista sugerido? Cumple los excluyentes y llega al umbral.
export const esFinalistaSugerido = (c: { puntajeFiltro: number | null; cumpleExcluyentes: boolean | null }) => c.puntajeFiltro !== null && c.puntajeFiltro >= UMBRAL_FINALISTA && c.cumpleExcluyentes !== false;

// Orden del tablero: primero los que cumplen los excluyentes, por puntaje
// del filtro; los sin evaluar, después de los evaluados que cumplen; al
// fondo, los que no cumplen un excluyente. Empates: la valoración de
// RR.HH. y después el que llegó primero.
export function ordenar<T extends { puntajeFiltro: number | null; cumpleExcluyentes: boolean | null; puntaje: number | null; createdAt: Date | string }>(candidatos: T[]): T[] {
  const grupo = (c: T) => (c.cumpleExcluyentes === false ? 2 : c.puntajeFiltro === null ? 1 : 0);
  return [...candidatos].sort((a, b) => grupo(a) - grupo(b) || (b.puntajeFiltro ?? -1) - (a.puntajeFiltro ?? -1) || (b.puntaje ?? 0) - (a.puntaje ?? 0) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// Lo que se le manda al navegador del candidato: la pregunta y sus
// opciones, NUNCA qué respuesta suma ni cuál es excluyente.
export interface PreguntaPublica { texto: string; tipo: TipoFiltro; opciones?: string[] }
export const preguntasPublicas = (preguntas: unknown): PreguntaPublica[] => (Array.isArray(preguntas) ? (preguntas as PreguntaFiltro[]) : []).map((p) => ({ texto: p.texto, tipo: p.tipo, ...(p.tipo === "opcion" ? { opciones: p.opciones } : {}) }));
