// FM RRHH — lib/evaluaciones-reglas.ts
// Evaluación de desempeño. Funciones puras, sin base de datos
// (tests/evaluaciones-reglas.test.mjs).

export const ESCALA: Record<number, { nombre: string; color: string }> = {
  1: { nombre: "No cumple", color: "#D98C8C" },
  2: { nombre: "Cumple en parte", color: "#E8B36B" },
  3: { nombre: "Cumple", color: "#F2D98D" },
  4: { nombre: "Supera", color: "#7DB89A" },
  5: { nombre: "Sobresaliente", color: "#2F6F5E" },
};
export const MAX_COMPETENCIAS = 15;

export interface Competencia { nombre: string; descripcion?: string }
export type Puntajes = Record<string, number>; // índice de la competencia → 1..5

export const ESTADOS: Record<string, string> = { pendiente: "Sin completar", completada: "Completada — sin entregar", entregada: "Entregada — falta que la firme", firmada: "Firmada" };

// El que se crea solo la primera vez. Punto de partida para personal de
// planta: cada empresa lo edita.
export const FORMULARIO_INICIAL: { nombre: string; competencias: Competencia[] } = {
  nombre: "Personal de planta",
  competencias: [
    { nombre: "Seguridad", descripcion: "Usa los elementos de protección y respeta las normas de seguridad." },
    { nombre: "Calidad del trabajo", descripcion: "Entrega el trabajo bien hecho, sin reprocesos ni reclamos." },
    { nombre: "Productividad", descripcion: "Cumple con los tiempos y las cantidades que se esperan del puesto." },
    { nombre: "Asistencia y puntualidad", descripcion: "Falta poco, llega a horario y avisa cuando no puede venir." },
    { nombre: "Trabajo en equipo", descripcion: "Colabora con sus compañeros y con su jefe; buen trato." },
    { nombre: "Orden y cuidado", descripcion: "Mantiene limpio su puesto y cuida máquinas, herramientas y materiales." },
    { nombre: "Iniciativa y polivalencia", descripcion: "Propone mejoras, aprende tareas nuevas y puede cubrir otros puestos." },
  ],
};

export function limpiarCompetencias(entrada: unknown): { competencias: Competencia[]; error: string | null } {
  if (!Array.isArray(entrada) || entrada.length === 0) return { competencias: [], error: "El formulario necesita al menos una competencia." };
  if (entrada.length > MAX_COMPETENCIAS) return { competencias: [], error: `Un formulario puede tener hasta ${MAX_COMPETENCIAS} competencias.` };
  const competencias: Competencia[] = [];
  for (const [i, c] of entrada.entries()) {
    const nombre = String(c?.nombre ?? "").trim().slice(0, 60);
    if (nombre.length < 3) return { competencias: [], error: `A la competencia ${i + 1} le falta el nombre.` };
    if (competencias.some((x) => x.nombre.toLowerCase() === nombre.toLowerCase())) return { competencias: [], error: `"${nombre}" está repetida.` };
    const descripcion = String(c?.descripcion ?? "").trim().slice(0, 200);
    competencias.push({ nombre, ...(descripcion ? { descripcion } : {}) });
  }
  return { competencias, error: null };
}

// Lo que llega del formulario → solo puntajes válidos para ESAS competencias.
export function limpiarPuntajes(entrada: unknown, cantidad: number): Puntajes {
  const puntajes: Puntajes = {};
  if (!entrada || typeof entrada !== "object") return puntajes;
  for (let i = 0; i < cantidad; i++) {
    const v = Number((entrada as Record<string, unknown>)[String(i)]);
    if (Number.isInteger(v) && v in ESCALA) puntajes[String(i)] = v;
  }
  return puntajes;
}

// Para dar una evaluación por completa: todas las competencias puntuadas y,
// si alguna quedó en "no cumple" o "cumple en parte", algo escrito en "a
// mejorar" — una nota baja sin explicación no le sirve a nadie.
export function motivoIncompleta(competencias: Competencia[], puntajes: Puntajes, aMejorar: string): string | null {
  const falta = competencias.findIndex((_, i) => !(String(i) in puntajes));
  if (falta !== -1) return `Falta puntuar "${competencias[falta].nombre}".`;
  if (Object.values(puntajes).some((v) => v <= 2) && aMejorar.trim().length < 10) return "Pusiste alguna nota baja: escribí en «A mejorar» qué se espera que cambie.";
  return null;
}

export function promedio(puntajes: Puntajes | null | undefined): number | null {
  const valores = Object.values(puntajes ?? {});
  return valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100 : null;
}

// Resumen de un ciclo: cuánto falta, promedio general y por competencia.
// Solo cuentan las evaluaciones ya completadas.
export function resumenCiclo(competencias: Competencia[], evaluaciones: { estado: string; puntajes: unknown; promedio: number | null }[]) {
  const hechas = evaluaciones.filter((e) => e.estado !== "pendiente");
  const porCompetencia = competencias.map((c, i) => {
    const valores = hechas.map((e) => Number((e.puntajes as Puntajes | null)?.[String(i)])).filter((v) => v >= 1);
    return { nombre: c.nombre, promedio: valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100 : null };
  });
  const promedios = hechas.map((e) => e.promedio).filter((p): p is number => p !== null);
  const cuenta = (estado: string) => evaluaciones.filter((e) => e.estado === estado).length;
  return {
    total: evaluaciones.length, pendientes: cuenta("pendiente"), completadas: cuenta("completada"), entregadas: cuenta("entregada"), firmadas: cuenta("firmada"),
    promedioGeneral: promedios.length ? Math.round((promedios.reduce((a, b) => a + b, 0) / promedios.length) * 100) / 100 : null,
    porCompetencia,
  };
}
