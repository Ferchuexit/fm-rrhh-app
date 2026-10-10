// FM RRHH — lib/objetivos-reglas.ts
// Objetivos y plan de carrera. Funciones puras, sin base de datos
// (tests/objetivos-reglas.test.mjs).
import { estadoHabilidad } from "./capacitaciones-reglas";

export const ESTADOS_OBJETIVO: Record<string, string> = { en_curso: "En curso", cumplido: "Cumplido", no_cumplido: "No cumplido", cancelado: "Cancelado" };
export const CIERRES = ["cumplido", "no_cumplido", "cancelado"] as const;
export const MAX_REQUISITOS = 20;

export function validarObjetivo(entrada: any, fechaLimite: Date | null, hoy: Date): { datos: { titulo: string; descripcion: string | null }; error: string | null } {
  const titulo = String(entrada?.titulo ?? "").trim().slice(0, 120);
  const descripcion = String(entrada?.descripcion ?? "").trim().slice(0, 1000) || null;
  const datos = { titulo, descripcion };
  if (titulo.length < 5) return { datos, error: "Escribí el objetivo (por ejemplo: «Bajar el scrap de la línea 2 a menos del 3%»)." };
  if (!fechaLimite) return { datos, error: "Poné para cuándo es." };
  if (fechaLimite < hoy) return { datos, error: "La fecha tiene que ser de hoy en adelante." };
  return { datos, error: null };
}

// El avance que alguien informa: 0..100, de a enteros. null = inválido.
export function limpiarAvance(valor: unknown): number | null {
  // null y "" darían 0 con Number(): alguien que no informó nada no informó 0%.
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

// Cómo se muestra un objetivo en curso: vencido si pasó la fecha, "por
// vencer" si faltan 15 días o menos.
export type Semaforo = "cerrado" | "vencido" | "por_vencer" | "en_fecha";
export function semaforo(o: { estado: string; fechaLimite: Date }, hoy: Date): Semaforo {
  if (o.estado !== "en_curso") return "cerrado";
  const dias = Math.round((o.fechaLimite.getTime() - hoy.getTime()) / 86400000);
  return dias < 0 ? "vencido" : dias <= 15 ? "por_vencer" : "en_fecha";
}

export function resumenObjetivos(objetivos: { estado: string; fechaLimite: Date }[], hoy: Date) {
  const cuenta = (e: string) => objetivos.filter((o) => o.estado === e).length;
  const cerrados = cuenta("cumplido") + cuenta("no_cumplido");
  return {
    enCurso: cuenta("en_curso"), vencidos: objetivos.filter((o) => semaforo(o, hoy) === "vencido").length,
    cumplidos: cuenta("cumplido"), noCumplidos: cuenta("no_cumplido"),
    // De los que se cerraron con resultado (los cancelados no cuentan).
    cumplimiento: cerrados ? Math.round((cuenta("cumplido") / cerrados) * 100) : null,
  };
}

// ── Plan de carrera ──
export interface Requisito { habilidadId: string; nivel: number }

export function limpiarRequisitos(entrada: unknown, habilidadesValidas: Set<string>): { requisitos: Requisito[]; error: string | null } {
  if (!Array.isArray(entrada)) return { requisitos: [], error: null };
  if (entrada.length > MAX_REQUISITOS) return { requisitos: [], error: `Un plan puede pedir hasta ${MAX_REQUISITOS} habilidades.` };
  const requisitos: Requisito[] = [];
  for (const r of entrada) {
    const habilidadId = String(r?.habilidadId ?? "");
    const nivel = Number(r?.nivel);
    if (!habilidadesValidas.has(habilidadId)) return { requisitos: [], error: "Una de las habilidades ya no existe. Recargá la página." };
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > 4) return { requisitos: [], error: "El nivel pedido tiene que ser de 1 a 4." };
    if (!requisitos.some((x) => x.habilidadId === habilidadId)) requisitos.push({ habilidadId, nivel });
  }
  return { requisitos, error: null };
}

// Qué le falta para el puesto al que apunta: cada habilidad pedida contra
// lo que tiene hoy en la matriz. Una habilidad vencida no cuenta como
// tenida (hay que renovarla).
export function brecha(requisitos: Requisito[], tiene: { habilidadId: string; nivel: number; vence: Date | null }[], hoy: Date) {
  const detalle = requisitos.map((r) => {
    const actual = tiene.find((t) => t.habilidadId === r.habilidadId);
    const vencida = !!actual && estadoHabilidad(actual.vence, hoy) === "vencida";
    const nivelActual = actual?.nivel ?? 0;
    return { habilidadId: r.habilidadId, pedido: r.nivel, actual: nivelActual, vencida, cumple: nivelActual >= r.nivel && !vencida };
  });
  const cumplidos = detalle.filter((d) => d.cumple).length;
  return { detalle, cumplidos, total: detalle.length, porcentaje: detalle.length ? Math.round((cumplidos / detalle.length) * 100) : null };
}
