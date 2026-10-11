// FM RRHH — lib/encuestas-reglas.ts
// Encuestas de clima: preguntas, respuestas y cómo se calculan los
// resultados. Funciones puras, sin base de datos
// (tests/encuestas-reglas.test.mjs).

export type TipoPregunta = "escala" | "enps" | "opcion" | "texto";
export interface Pregunta { texto: string; tipo: TipoPregunta; dimension?: string; opciones?: string[] }
export type Respuestas = Record<string, number | string>; // índice de la pregunta → respuesta

export const TIPOS_PREGUNTA: Record<TipoPregunta, string> = {
  escala: "De acuerdo / en desacuerdo (1 a 5)",
  enps: "¿Recomendarías…? (0 a 10)",
  opcion: "Elegir una opción",
  texto: "Texto libre",
};
export const ESCALA_ACUERDO = ["Muy en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Muy de acuerdo"];
export const MAX_PREGUNTAS = 40;

// ANONIMATO: con menos respuestas que esto no se muestra ningún resultado
// (ni el general, ni el de un sector). Con 2 o 3 respuestas, cualquiera
// deduce quién dijo qué.
export const MINIMO_ANONIMATO = 5;

// Puntos de partida. Las afirmaciones están en positivo: "de acuerdo"
// siempre es lo bueno, así los promedios se leen todos igual.
export const PLANTILLAS_ENCUESTA: { nombre: string; titulo: string; descripcion: string; preguntas: Pregunta[] }[] = [
  {
    nombre: "Clima laboral",
    titulo: "Encuesta de clima",
    descripcion: "Queremos saber cómo te sentís trabajando acá. Es anónima: nadie puede ver qué respondió cada uno.",
    preguntas: [
      { tipo: "escala", dimension: "Liderazgo", texto: "Mi jefe me trata con respeto." },
      { tipo: "escala", dimension: "Liderazgo", texto: "Mi jefe me explica con claridad qué espera de mi trabajo." },
      { tipo: "escala", dimension: "Liderazgo", texto: "Cuando tengo un problema, mi jefe me escucha." },
      { tipo: "escala", dimension: "Comunicación", texto: "Me entero a tiempo de los cambios que afectan mi trabajo." },
      { tipo: "escala", dimension: "Comunicación", texto: "Puedo decir lo que pienso sin miedo a que me perjudique." },
      { tipo: "escala", dimension: "Condiciones y seguridad", texto: "Tengo las herramientas y los elementos de protección que necesito." },
      { tipo: "escala", dimension: "Condiciones y seguridad", texto: "Me siento seguro en mi puesto de trabajo." },
      { tipo: "escala", dimension: "Condiciones y seguridad", texto: "Los horarios y los turnos me permiten organizar mi vida." },
      { tipo: "escala", dimension: "Reconocimiento", texto: "Cuando hago bien mi trabajo, alguien me lo reconoce." },
      { tipo: "escala", dimension: "Reconocimiento", texto: "Lo que cobro es justo para lo que hago." },
      { tipo: "escala", dimension: "Crecimiento", texto: "Acá puedo aprender cosas nuevas." },
      { tipo: "escala", dimension: "Crecimiento", texto: "Veo posibilidades de crecer en la empresa." },
      { tipo: "escala", dimension: "Compañerismo", texto: "Entre compañeros nos ayudamos." },
      { tipo: "enps", texto: "¿Le recomendarías a un amigo o familiar trabajar en esta empresa?" },
      { tipo: "texto", texto: "¿Qué es lo mejor de trabajar acá?" },
      { tipo: "texto", texto: "Si pudieras cambiar una sola cosa, ¿cuál sería?" },
    ],
  },
  {
    nombre: "Pulso (5 preguntas)",
    titulo: "¿Cómo venimos?",
    descripcion: "Cinco preguntas, un minuto. Es anónima.",
    preguntas: [
      { tipo: "escala", dimension: "Liderazgo", texto: "Mi jefe me trata con respeto y me escucha." },
      { tipo: "escala", dimension: "Condiciones y seguridad", texto: "Tengo lo que necesito para trabajar bien y seguro." },
      { tipo: "escala", dimension: "Reconocimiento", texto: "Siento que mi trabajo se valora." },
      { tipo: "enps", texto: "¿Le recomendarías a un amigo o familiar trabajar en esta empresa?" },
      { tipo: "texto", texto: "¿Algo que quieras contarnos?" },
    ],
  },
];

export function limpiarPreguntas(entrada: unknown): { preguntas: Pregunta[]; error: string | null } {
  if (!Array.isArray(entrada) || entrada.length === 0) return { preguntas: [], error: "La encuesta necesita al menos una pregunta." };
  if (entrada.length > MAX_PREGUNTAS) return { preguntas: [], error: `Una encuesta puede tener hasta ${MAX_PREGUNTAS} preguntas. Las encuestas largas se abandonan por la mitad.` };
  const preguntas: Pregunta[] = [];
  for (const [i, p] of entrada.entries()) {
    const texto = String(p?.texto ?? "").trim().slice(0, 300);
    if (texto.length < 5) return { preguntas: [], error: `A la pregunta ${i + 1} le falta el texto.` };
    const tipo = p?.tipo as TipoPregunta;
    if (!(tipo in TIPOS_PREGUNTA)) return { preguntas: [], error: `Elegí el tipo de la pregunta ${i + 1}.` };
    const dimension = String(p?.dimension ?? "").trim().slice(0, 40);
    const pregunta: Pregunta = { texto, tipo, ...(dimension && tipo === "escala" ? { dimension } : {}) };
    if (tipo === "opcion") {
      const opciones = [...new Set((Array.isArray(p?.opciones) ? p.opciones : []).map((o: unknown) => String(o ?? "").trim().slice(0, 80)).filter(Boolean))] as string[];
      if (opciones.length < 2 || opciones.length > 8) return { preguntas: [], error: `La pregunta ${i + 1} necesita entre 2 y 8 opciones distintas.` };
      pregunta.opciones = opciones;
    }
    preguntas.push(pregunta);
  }
  if (!preguntas.some((p) => p.tipo !== "texto")) return { preguntas: [], error: "Sumá al menos una pregunta que no sea de texto libre: son las que se pueden medir." };
  return { preguntas, error: null };
}

// Lo que mandó el empleado → respuestas válidas para ESAS preguntas. Las
// de texto libre son opcionales; el resto, obligatorias.
export function limpiarRespuestas(preguntas: Pregunta[], entrada: unknown): { respuestas: Respuestas; error: string | null } {
  const respuestas: Respuestas = {};
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  for (const [i, p] of preguntas.entries()) {
    const v = e[String(i)];
    if (p.tipo === "texto") {
      const t = String(v ?? "").trim().slice(0, 1000);
      if (t) respuestas[i] = t;
      continue;
    }
    const n = v === null || v === undefined || v === "" ? NaN : Number(v);
    const [min, max] = p.tipo === "escala" ? [1, 5] : p.tipo === "enps" ? [0, 10] : [0, (p.opciones?.length ?? 1) - 1];
    if (!Number.isInteger(n) || n < min || n > max) return { respuestas: {}, error: `Te falta responder: «${p.texto}»` };
    respuestas[i] = n;
  }
  return { respuestas, error: null };
}

const redondo = (n: number) => Math.round(n * 100) / 100;
const promedioDe = (v: number[]) => (v.length ? redondo(v.reduce((a, b) => a + b, 0) / v.length) : null);
// "Favorable" = de acuerdo o muy de acuerdo (4 o 5).
const favorableDe = (v: number[]) => (v.length ? Math.round((v.filter((x) => x >= 4).length / v.length) * 100) : null);

// Desordena siempre igual para la misma encuesta: los comentarios no deben
// salir en el orden en que se cargaron (delataría quién escribió cuál),
// pero tampoco cambiar de lugar cada vez que se abre la pantalla.
function desordenar<T>(items: T[], semilla: string): T[] {
  let s = [...semilla].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const azar = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const r = [...items];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

export function resultados(preguntas: Pregunta[], respuestas: { sector: string | null; respuestas: unknown }[], semilla = "", minimo = MINIMO_ANONIMATO) {
  const total = respuestas.length;
  if (total < minimo) return { total, suficientes: false as const, minimo };
  const de = (lista: typeof respuestas, i: number) => lista.map((r) => (r.respuestas as Respuestas | null)?.[String(i)]).filter((v) => v !== undefined && v !== null && v !== "");
  const numeros = (lista: typeof respuestas, i: number) => de(lista, i).map(Number).filter((n) => Number.isFinite(n));

  const porPregunta = preguntas.map((p, i) => {
    if (p.tipo === "texto") return { ...p, indice: i, comentarios: desordenar(de(respuestas, i).map(String), `${semilla}:${i}`) };
    const v = numeros(respuestas, i);
    const largo = p.tipo === "escala" ? 5 : p.tipo === "enps" ? 11 : p.opciones?.length ?? 0;
    const base = p.tipo === "escala" ? 1 : 0;
    const distribucion = Array.from({ length: largo }, (_, k) => v.filter((x) => x === k + base).length);
    return { ...p, indice: i, respondieron: v.length, distribucion, ...(p.tipo === "escala" ? { promedio: promedioDe(v), favorable: favorableDe(v) } : {}) };
  });

  const escalas = preguntas.map((p, i) => ({ p, i })).filter((x) => x.p.tipo === "escala");
  const todas = (lista: typeof respuestas, items = escalas) => items.flatMap((x) => numeros(lista, x.i));
  const dimensiones = [...new Set(escalas.map((x) => x.p.dimension ?? "General"))];
  const porDimension = dimensiones.map((nombre) => {
    const v = todas(respuestas, escalas.filter((x) => (x.p.dimension ?? "General") === nombre));
    return { nombre, promedio: promedioDe(v), favorable: favorableDe(v) };
  }).sort((a, b) => (a.promedio ?? 0) - (b.promedio ?? 0)); // primero lo que peor está

  // eNPS: % de promotores (9-10) menos % de detractores (0-6). Va de -100 a 100.
  const iEnps = preguntas.findIndex((p) => p.tipo === "enps");
  const ve = iEnps === -1 ? [] : numeros(respuestas, iEnps);
  const enps = ve.length ? { promotores: ve.filter((x) => x >= 9).length, pasivos: ve.filter((x) => x === 7 || x === 8).length, detractores: ve.filter((x) => x <= 6).length, puntaje: Math.round(((ve.filter((x) => x >= 9).length - ve.filter((x) => x <= 6).length) / ve.length) * 100) } : null;

  // Por sector: solo los que llegan al mínimo. El resto se informa junto,
  // sin resultado, para que se sepa que hubo respuestas.
  const sectores = [...new Set(respuestas.map((r) => r.sector ?? "Sin sector"))].sort();
  // Ojo con la resta: si se muestra el general y todos los sectores menos
  // uno chico, restando se obtiene el resultado de ese sector chico. Por
  // eso, si los sectores que no llegan al mínimo suman entre todos menos
  // que el mínimo, no se abre por sector para nadie.
  const cuantos = (sector: string) => respuestas.filter((r) => (r.sector ?? "Sin sector") === sector).length;
  const ocultas = sectores.map(cuantos).filter((n) => n < minimo).reduce((a, b) => a + b, 0);
  const sePuedeAbrir = ocultas === 0 || ocultas >= minimo;
  const porSector = sectores.map((sector) => {
    const lista = respuestas.filter((r) => (r.sector ?? "Sin sector") === sector);
    const visible = sePuedeAbrir && lista.length >= minimo;
    const v = visible ? todas(lista) : [];
    return { sector, respuestas: lista.length, visible, promedio: visible ? promedioDe(v) : null, favorable: visible ? favorableDe(v) : null };
  });

  const generales = todas(respuestas);
  return { total, suficientes: true as const, minimo, promedio: promedioDe(generales), favorable: favorableDe(generales), enps, porDimension, porPregunta, porSector };
}
