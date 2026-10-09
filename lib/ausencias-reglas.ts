// FM RRHH — lib/ausencias-reglas.ts
// Reglas de los pedidos de vacaciones/permisos del portal — funciones
// puras, sin base de datos, para poder probarlas solas
// (tests/ausencias-reglas.test.mjs).
import { diasVacacionesPorAntiguedad, calcularAntiguedadAnios } from "./vacaciones";

export const MAX_DIAS_PEDIDO = 60;
export const TIPOS_AUSENCIA = ["vacaciones", "permiso"] as const;
export type TipoAusencia = (typeof TIPOS_AUSENCIA)[number];

const DIA_MS = 24 * 3600 * 1000;

// "2026-11-03" → medianoche UTC de ese día (mismo criterio que el resto del
// sistema para fechas sin hora). null si no es una fecha real (31/02, etc.).
export function fechaDesdeTexto(texto: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? ""));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

// El "hoy" que importa es el de Argentina: a las 22 hs de acá el servidor
// (UTC) ya está en mañana.
export function hoyArgentina(ahora = new Date()): Date {
  const txt = ahora.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); // YYYY-MM-DD
  return fechaDesdeTexto(txt)!;
}

// Días CORRIDOS, contando los dos extremos — así se cuentan las vacaciones
// en la LCT (art. 150), sábados, domingos y feriados incluidos.
export function diasCorridos(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / DIA_MS) + 1;
}

export function seSuperponen(aDesde: Date, aHasta: Date, bDesde: Date, bHasta: Date): boolean {
  return aDesde <= bHasta && bDesde <= aHasta;
}

export interface SaldoVacaciones {
  anio: number;
  corresponden: number; // por antigüedad al 31/12 del año
  registrados: number; // Vacacion ya cargadas para ese año
  enTramite: number; // pedidos pendientes de respuesta
  disponibles: number;
}

// Mismo cálculo que /api/vacaciones/pendientes (antigüedad al 31/12 del
// año), más lo que el empleado ya tiene pedido y sin responder — si no,
// podría pedir dos veces los mismos días.
export function calcularSaldo(
  legajo: { fechaIngreso: Date; antiguedadReconocida: Date | null },
  anio: number,
  diasRegistrados: number,
  diasEnTramite: number
): SaldoVacaciones {
  const antiguedad = calcularAntiguedadAnios(legajo.fechaIngreso, legajo.antiguedadReconocida, new Date(anio, 11, 31));
  const corresponden = diasVacacionesPorAntiguedad(antiguedad);
  return { anio, corresponden, registrados: diasRegistrados, enTramite: diasEnTramite, disponibles: Math.max(0, corresponden - diasRegistrados - diasEnTramite) };
}

// Devuelve el motivo por el que el pedido no se puede tomar, o null si está
// bien. `ocupados` = rangos que ya tiene el empleado (pedidos vivos y
// vacaciones registradas).
export function validarPedido(p: {
  tipo: unknown;
  desde: Date | null;
  hasta: Date | null;
  motivo: string;
  hoy: Date;
  saldoDisponible: number;
  ocupados: { desde: Date; hasta: Date; descripcion: string }[];
}): string | null {
  if (!TIPOS_AUSENCIA.includes(p.tipo as TipoAusencia)) return "Elegí si pedís vacaciones o un permiso.";
  if (!p.desde || !p.hasta) return "Completá las dos fechas.";
  if (p.hasta < p.desde) return "La fecha de regreso no puede ser anterior a la de salida.";
  if (p.desde < p.hoy) return "No se puede pedir para una fecha que ya pasó. Si fue una ausencia, avisale a RR.HH.";
  const dias = diasCorridos(p.desde, p.hasta);
  if (dias > MAX_DIAS_PEDIDO) return `Un pedido no puede superar los ${MAX_DIAS_PEDIDO} días. Si necesitás más, hablalo con RR.HH.`;
  if (p.tipo === "permiso" && p.motivo.trim().length < 5) return "Contá en pocas palabras para qué es el permiso.";
  const choque = p.ocupados.find((o) => seSuperponen(p.desde!, p.hasta!, o.desde, o.hasta));
  if (choque) return `Esas fechas se pisan con ${choque.descripcion}.`;
  if (p.tipo === "vacaciones" && dias > p.saldoDisponible) {
    return p.saldoDisponible === 0
      ? "No te quedan días de vacaciones disponibles para ese año."
      : `Estás pidiendo ${dias} días y te quedan ${p.saldoDisponible} disponibles para ese año.`;
  }
  return null;
}
