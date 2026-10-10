// FM RRHH — lib/turnos-reglas.ts
// Horarios de trabajo: qué le toca a cada persona cada día, incluidas las
// rotaciones semanales y los turnos que terminan al día siguiente.
// Funciones puras, sin base de datos (tests/turnos-reglas.test.mjs).

export interface DiaHorario { ingreso: string; salida: string } // "HH:mm"
export type Dias = Record<string, DiaHorario>; // clave "0".."6" (0 = domingo)
export interface Horario { id: string; nombre: string; color: string; dias: Dias }
export interface Asignacion { desde: Date; hasta: Date | null; horarioIds: string[] }

const DIA_MS = 24 * 3600 * 1000;
export const NOMBRE_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const COLORES_HORARIO = ["#7FA8C6", "#E8B36B", "#6E6AA8", "#7DB89A", "#D98C8C", "#9AA5B1"];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
// Termina al día siguiente (22:00 → 06:00).
export const esNocturno = (d: DiaHorario) => aMinutos(d.salida) <= aMinutos(d.ingreso);
export const horasDelDia = (d: DiaHorario) => ((aMinutos(d.salida) - aMinutos(d.ingreso) + 1440) % 1440 || 1440) / 60;

// Lo que llega del formulario → solo días válidos. Devuelve el motivo si
// hay algo mal escrito.
export function limpiarDias(entrada: unknown): { dias: Dias; error: string | null } {
  const dias: Dias = {};
  if (!entrada || typeof entrada !== "object") return { dias, error: "Marcá al menos un día de trabajo." };
  for (const [clave, valor] of Object.entries(entrada as Record<string, any>)) {
    if (!/^[0-6]$/.test(clave) || !valor) continue;
    const ingreso = String(valor.ingreso ?? ""), salida = String(valor.salida ?? "");
    if (!HORA.test(ingreso) || !HORA.test(salida)) return { dias, error: `Revisá el horario del ${NOMBRE_DIA[+clave].toLowerCase()}: van las dos horas, en formato 24 hs (por ejemplo 06:00 y 14:00).` };
    if (ingreso === salida) return { dias, error: `El ${NOMBRE_DIA[+clave].toLowerCase()} entra y sale a la misma hora.` };
    dias[clave] = { ingreso, salida };
  }
  if (Object.keys(dias).length === 0) return { dias, error: "Marcá al menos un día de trabajo." };
  return { dias, error: null };
}

// "L a V 06:00–14:00 · Sáb 06:00–10:00" — para mostrar un horario en una línea.
export function resumenHorario(dias: Dias): string {
  const corto = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const orden = [1, 2, 3, 4, 5, 6, 0]; // la semana arranca el lunes
  const grupos: { desde: number; hasta: number; texto: string }[] = [];
  for (const [pos, d] of orden.entries()) {
    const h = dias[String(d)];
    if (!h) continue;
    const texto = `${h.ingreso}–${h.salida}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === texto && ultimo.hasta === pos - 1) ultimo.hasta = pos;
    else grupos.push({ desde: pos, hasta: pos, texto });
  }
  return grupos.map((g) => `${g.desde === g.hasta ? corto[orden[g.desde]] : `${corto[orden[g.desde]]} a ${corto[orden[g.hasta]]}`} ${g.texto}`).join(" · ");
}

// El lunes de la semana de esa fecha (fechas a medianoche UTC, como en
// todo el sistema).
export function lunesDe(fecha: Date): Date {
  const dia = fecha.getUTCDay(); // 0 = domingo
  return new Date(fecha.getTime() - ((dia + 6) % 7) * DIA_MS);
}

export function asignacionVigente<A extends Asignacion>(fecha: Date, asignaciones: A[]): A | null {
  let mejor: A | null = null;
  for (const a of asignaciones) {
    if (a.desde > fecha || (a.hasta && a.hasta < fecha)) continue;
    if (!mejor || a.desde > mejor.desde) mejor = a; // si se pisan, manda la más nueva
  }
  return mejor;
}

// En una rotación, qué horario toca la semana de `fecha`: la semana de
// `desde` es la primera, y se cambia cada lunes.
export function horarioDeLaSemana(fecha: Date, a: Asignacion): string | null {
  if (a.horarioIds.length === 0) return null;
  const semanas = Math.round((lunesDe(fecha).getTime() - lunesDe(a.desde).getTime()) / (7 * DIA_MS));
  return a.horarioIds[((semanas % a.horarioIds.length) + a.horarioIds.length) % a.horarioIds.length];
}

export type Jornada =
  | { tipo: "sin_asignar" } // no tiene horario cargado: vale el turno de respaldo, si hay
  | { tipo: "franco"; horario: Horario } // tiene horario y ese día no trabaja
  | { tipo: "trabaja"; horario: Horario; ingreso: string; salida: string; nocturno: boolean };

export function jornadaDelDia(fecha: Date, asignaciones: Asignacion[], horarios: Map<string, Horario>): Jornada {
  const a = asignacionVigente(fecha, asignaciones);
  const horario = a ? horarios.get(horarioDeLaSemana(fecha, a) ?? "") : undefined;
  if (!horario) return { tipo: "sin_asignar" }; // sin asignación, o el horario fue borrado
  const d = horario.dias[String(fecha.getUTCDay())];
  if (!d) return { tipo: "franco", horario };
  return { tipo: "trabaja", horario, ingreso: d.ingreso, salida: d.salida, nocturno: esNocturno(d) };
}

// ── Fichadas de un turno que cruza la medianoche ─────────────────────
// La fichada de salida de un turno noche queda guardada con la fecha del
// día siguiente. Para evaluar el turno hay que juntar la entrada de un día
// con la salida del otro, y NO contarle esa salida al día siguiente.
//
// MARGEN: cuánto antes del ingreso o después de la salida una fichada
// todavía se considera de ese turno (llegó temprano, se quedó un rato).
const MARGEN_MIN = 4 * 60;
const sumar24 = (hora: string) => `${String(Number(hora.slice(0, 2)) + 24).padStart(2, "0")}${hora.slice(2)}`;
// "30:05:00" (las 6:05 del día siguiente) → "06:05:00", para guardar.
export const horaDeReloj = (hora: string | null) => (hora && Number(hora.slice(0, 2)) >= 24 ? `${String(Number(hora.slice(0, 2)) - 24).padStart(2, "0")}${hora.slice(2)}` : hora);

// Las fichadas que corresponden a la jornada de HOY. Las del día siguiente
// vuelven con la hora +24 ("30:05:00") para que el orden y las cuentas de
// minutos den bien; antes de guardar se pasan por horaDeReloj().
export function fichadasDeLaJornada(hoy: Jornada, ayer: Jornada, fichadasHoy: string[], fichadasManiana: string[]): string[] {
  let propias = fichadasHoy;

  // Lo que quedó de la noche anterior no es de hoy — salvo que hoy se
  // entre tan temprano que no se pueda distinguir (ahí no se saca nada).
  if (ayer.tipo === "trabaja" && ayer.nocturno) {
    const finDeAyer = aMinutos(ayer.salida) + MARGEN_MIN;
    const hoyArrancaDespues = hoy.tipo !== "trabaja" || aMinutos(hoy.ingreso) - MARGEN_MIN >= finDeAyer || hoy.nocturno;
    if (hoyArrancaDespues) propias = propias.filter((h) => aMinutos(h) > finDeAyer);
  }

  if (hoy.tipo === "trabaja" && hoy.nocturno) {
    const desde = aMinutos(hoy.ingreso) - MARGEN_MIN;
    const hasta = aMinutos(hoy.salida) + MARGEN_MIN;
    return [...propias.filter((h) => aMinutos(h) >= desde), ...fichadasManiana.filter((h) => aMinutos(h) <= hasta).map(sumar24)];
  }
  return propias;
}

// El turno tal como lo espera el motor de asistencia: en un nocturno, la
// salida va +24 hs para que "salió 5 minutos antes" se calcule bien.
export function turnoParaElMotor(j: Jornada): { horaIngreso: string; horaSalida: string } | null {
  if (j.tipo !== "trabaja") return null;
  return { horaIngreso: j.ingreso, horaSalida: j.nocturno ? sumar24(j.salida) : j.salida };
}
