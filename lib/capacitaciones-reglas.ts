// FM RRHH — lib/capacitaciones-reglas.ts
// Capacitaciones y matriz de habilidades. Funciones puras, sin base de
// datos (tests/capacitaciones-reglas.test.mjs).

// Los cuatro niveles clásicos de una matriz de polivalencia.
export const NIVELES: Record<number, { nombre: string; corto: string; color: string }> = {
  1: { nombre: "En formación", corto: "Formación", color: "#F2D98D" },
  2: { nombre: "Trabaja con supervisión", corto: "Supervisado", color: "#E8B36B" },
  3: { nombre: "Autónomo", corto: "Autónomo", color: "#7DB89A" },
  4: { nombre: "Puede enseñar", corto: "Instructor", color: "#2F6F5E" },
};
// Desde este nivel la persona puede cubrir el puesto sola.
export const NIVEL_AUTONOMO = 3;
// Con menos gente autónoma que esto, el puesto depende de una sola persona.
export const MINIMO_COBERTURA = 2;
export const DIAS_AVISO_VENCIMIENTO = 60;

export const TIPOS_CAPACITACION: Record<string, string> = { seguridad: "Seguridad e higiene", tecnica: "Técnica / del puesto", induccion: "Inducción", otra: "Otra" };

const DIA_MS = 24 * 3600 * 1000;

// Cuándo vence una habilidad obtenida (o renovada) en `fecha`.
export function vencimientoDe(fecha: Date, vigenciaMeses: number | null | undefined): Date | null {
  if (!vigenciaMeses) return null;
  const v = new Date(fecha);
  v.setUTCMonth(v.getUTCMonth() + vigenciaMeses);
  // 31/08 + 6 meses no existe: JS salta a marzo. Se queda en el último día del mes que corresponde.
  if (v.getUTCDate() !== fecha.getUTCDate()) v.setUTCDate(0);
  return v;
}

export type EstadoHabilidad = "vigente" | "por_vencer" | "vencida";
export function estadoHabilidad(vence: Date | null, hoy: Date): EstadoHabilidad {
  if (!vence) return "vigente";
  if (vence < hoy) return "vencida";
  return vence.getTime() - hoy.getTime() <= DIAS_AVISO_VENCIMIENTO * DIA_MS ? "por_vencer" : "vigente";
}

// ¿Cuenta para cubrir el puesto? Autónomo o más, y sin vencer.
export const cubre = (c: { nivel: number; vence: Date | null }, hoy: Date) => c.nivel >= NIVEL_AUTONOMO && estadoHabilidad(c.vence, hoy) !== "vencida";

// Cuánta gente puede cubrir una habilidad hoy, y si depende de una sola persona.
export function cobertura(celdas: { nivel: number; vence: Date | null }[], hoy: Date) {
  const autonomos = celdas.filter((c) => cubre(c, hoy)).length;
  return { autonomos, enFormacion: celdas.filter((c) => c.nivel < NIVEL_AUTONOMO).length, vencidas: celdas.filter((c) => estadoHabilidad(c.vence, hoy) === "vencida").length, riesgo: autonomos < MINIMO_COBERTURA };
}

// Qué queda en la matriz cuando alguien asiste a una capacitación que
// otorga `nivelOtorgado`: nunca le baja el nivel que ya tenía, y siempre le
// renueva la fecha (una recapacitación extiende el vencimiento).
export function trasCapacitar(actual: { nivel: number } | null, nivelOtorgado: number, fecha: Date, vigenciaMeses: number | null | undefined) {
  return { nivel: Math.max(actual?.nivel ?? 0, nivelOtorgado), desde: fecha, vence: vencimientoDe(fecha, vigenciaMeses) };
}

export function validarHabilidad(entrada: any): { datos: { nombre: string; grupo: string; vigenciaMeses: number | null }; error: string | null } {
  const nombre = String(entrada?.nombre ?? "").trim().slice(0, 60);
  const grupo = String(entrada?.grupo ?? "").trim().slice(0, 40) || "General";
  const crudo = entrada?.vigenciaMeses;
  const vigenciaMeses = crudo === null || crudo === undefined || crudo === "" || Number(crudo) === 0 ? null : Number(crudo);
  const datos = { nombre, grupo, vigenciaMeses };
  if (nombre.length < 2) return { datos, error: "Escribí el nombre de la habilidad (por ejemplo: Autoelevador)." };
  if (vigenciaMeses !== null && (!Number.isInteger(vigenciaMeses) || vigenciaMeses < 1 || vigenciaMeses > 120)) return { datos, error: "La vigencia va en meses, entre 1 y 120. Dejala vacía si no vence." };
  return { datos, error: null };
}

export function validarCapacitacion(entrada: any, fecha: Date | null): string | null {
  if (String(entrada?.titulo ?? "").trim().length < 3) return "Escribí el título de la capacitación.";
  if (!fecha) return "Elegí la fecha.";
  if (!(String(entrada?.tipo ?? "") in TIPOS_CAPACITACION)) return "Elegí el tipo de capacitación.";
  const horas = entrada?.horas;
  if (horas !== null && horas !== undefined && horas !== "" && (!(Number(horas) > 0) || Number(horas) > 400)) return "Las horas tienen que ser un número mayor que cero.";
  if (entrada?.habilidadId && !(Number(entrada?.nivelOtorgado) in NIVELES)) return "Elegí qué nivel otorga en esa habilidad.";
  if (!Array.isArray(entrada?.legajoIds) || entrada.legajoIds.length === 0) return "Elegí al menos un asistente.";
  return null;
}
