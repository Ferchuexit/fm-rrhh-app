// FM RRHH — lib/planificacion-reglas.ts
// Cuentas de la planificación de vacaciones: cuánta gente hay afuera a la
// vez y cuánto cuesta un rango de fechas. Funciones puras, sin base de
// datos (tests/planificacion-reglas.test.mjs). Las usa también el Gantt en
// el navegador.

const DIA_MS = 24 * 3600 * 1000;
// LCT art. 155: el día de vacaciones se paga dividiendo el sueldo por 25.
export const DIVISOR_VACACIONES = 25;
const DIAS_MES = 30;

export interface Rango { desde: Date; hasta: Date }
export interface Ausencia extends Rango { legajoId: string; pendiente?: boolean }

// Días (corridos, extremos incluidos) que la ausencia cae DENTRO del rango.
export function diasEnRango(a: Rango, r: Rango): number {
  const desde = Math.max(a.desde.getTime(), r.desde.getTime());
  const hasta = Math.min(a.hasta.getTime(), r.hasta.getTime());
  return hasta < desde ? 0 : Math.round((hasta - desde) / DIA_MS) + 1;
}

// Cuántas PERSONAS distintas están afuera cada día del rango. Si alguien
// tiene dos registros que se pisan, cuenta una sola vez.
export function ausentesPorDia(r: Rango, ausencias: Ausencia[]): { fecha: Date; firmes: number; conPendientes: number }[] {
  const dias: { fecha: Date; firmes: number; conPendientes: number }[] = [];
  for (let t = r.desde.getTime(); t <= r.hasta.getTime(); t += DIA_MS) {
    const firmes = new Set<string>();
    const todos = new Set<string>();
    for (const a of ausencias) {
      if (a.desde.getTime() <= t && t <= a.hasta.getTime()) {
        todos.add(a.legajoId);
        if (!a.pendiente) firmes.add(a.legajoId);
      }
    }
    dias.push({ fecha: new Date(t), firmes: firmes.size, conPendientes: todos.size });
  }
  return dias;
}

// El peor día del rango: el máximo de gente afuera a la vez, y cuándo
// empieza. Es el número que importa para "¿me quedo sin gente?".
export function pico(dias: { fecha: Date; firmes: number; conPendientes: number }[], campo: "firmes" | "conPendientes") {
  let max = 0;
  let fecha: Date | null = null;
  for (const d of dias) if (d[campo] > max) { max = d[campo]; fecha = d.fecha; }
  return { cantidad: max, fecha };
}

// Para el Gantt: el año cortado en semanas, con el pico de cada una.
export function picoPorSemana(anio: number, ausencias: Ausencia[]) {
  const inicio = Date.UTC(anio, 0, 1);
  const fin = Date.UTC(anio, 11, 31);
  const semanas: { desde: Date; hasta: Date; firmes: number; conPendientes: number }[] = [];
  for (let t = inicio; t <= fin; t += 7 * DIA_MS) {
    const r = { desde: new Date(t), hasta: new Date(Math.min(t + 6 * DIA_MS, fin)) };
    const dias = ausentesPorDia(r, ausencias);
    semanas.push({ ...r, firmes: pico(dias, "firmes").cantidad, conPendientes: pico(dias, "conPendientes").cantidad });
  }
  return semanas;
}

// Sueldo bruto mensual de referencia: lo liquidado, llevado a 30 días. Así
// sirve igual para mensuales y para quincenas (dos quincenas = un mes).
// null si no hay nada liquidado: no se inventa un sueldo.
export function brutoMensualReferencia(liquidaciones: { bruto: number; dias: number }[]): number | null {
  const dias = liquidaciones.reduce((a, l) => a + l.dias, 0);
  if (dias <= 0) return null;
  return (liquidaciones.reduce((a, l) => a + l.bruto, 0) / dias) * DIAS_MES;
}

// Lo que cuesta un rango de fechas para una persona:
//   masa         = lo que cobraría trabajando normalmente esos días
//   vacaciones   = lo que se le paga por los días de vacaciones (sueldo / 25)
//   adicional    = cuánto MÁS se paga por estar de vacaciones en vez de
//                  trabajando (la diferencia entre dividir por 25 y por 30)
export function costoEnRango(brutoMensual: number, diasDelRango: number, diasVacaciones: number) {
  const masa = (brutoMensual / DIAS_MES) * diasDelRango;
  const vacaciones = (brutoMensual / DIVISOR_VACACIONES) * diasVacaciones;
  const adicional = vacaciones - (brutoMensual / DIAS_MES) * diasVacaciones;
  return { masa, vacaciones, adicional };
}
