// FM RRHH — lib/motor/prorrateo.mjs
//
// Calcula cuántos días REALMENTE trabajó un legajo dentro de un período,
// considerando altas y bajas a mitad de mes — hasta ahora, DIAS_TRABAJADOS
// en liquidar/route.ts siempre tomaba el período completo, sin importar
// si el legajo entró o salió a mitad de camino (un alta el 15 de agosto
// cobraba el mes entero).
//
// Función PURA a propósito, para poder probarla sin Prisma de por medio.
export function calcularDiasTrabajadosEnPeriodo({
  fechaDesdePeriodo,
  fechaHastaPeriodo,
  fechaIngresoLegajo,
  fechaEgresoLegajo,
}) {
  let inicio = fechaDesdePeriodo;
  let fin = fechaHastaPeriodo;

  // Entró DESPUÉS de que arrancó el período (alta a mitad de mes) — el
  // inicio efectivo pasa a ser su fecha de ingreso.
  if (fechaIngresoLegajo > fechaDesdePeriodo && fechaIngresoLegajo <= fechaHastaPeriodo) {
    inicio = fechaIngresoLegajo;
  }

  // Se fue ANTES de que termine el período (baja a mitad de mes) — el fin
  // efectivo pasa a ser su fecha de egreso.
  if (fechaEgresoLegajo && fechaEgresoLegajo >= fechaDesdePeriodo && fechaEgresoLegajo < fechaHastaPeriodo) {
    fin = fechaEgresoLegajo;
  }

  if (fin < inicio) return 0; // caso raro (ej. egreso cargado antes que el ingreso) — no debería pasar, pero no hay que devolver un número negativo

  const dias = Math.round((fin.getTime() - inicio.getTime()) / (24 * 3600 * 1000)) + 1;
  return Math.max(0, dias);
}
