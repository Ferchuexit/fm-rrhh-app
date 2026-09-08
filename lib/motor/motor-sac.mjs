// FM RRHH — lib/motor/motor-sac.mjs
//
// SAC (Sueldo Anual Complementario / aguinaldo) — Ley 23.041 y su Decreto
// 1078/84, arts. 121-123 LCT:
//   - Cada cuota = 50% de la MAYOR remuneración mensual BRUTA REMUNERATIVA
//     devengada dentro del semestre correspondiente (no el promedio — el
//     mejor mes, aunque los demás hayan sido más bajos).
//   - "Remuneración... remunerativa" excluye conceptos no remunerativos
//     (viáticos, sumas no remunerativas de paritaria, etc.) — quien arma
//     el contexto para esta función es responsable de sumar SOLO lo
//     remunerativo de cada mes antes de pasarlo acá.
//   - Si no se trabajó el semestre completo (alta/baja a mitad de
//     semestre, licencia sin goce de sueldo), se prorratea: SAC completo
//     × días trabajados en el semestre / días del semestre.
//   - Primer semestre: enero-junio. Segundo semestre: julio-diciembre.
//     Se paga junto con la liquidación de junio/diciembre, no aparte.
//
// Funciones PURAS a propósito, para poder probarlas sin Prisma de por
// medio. Toda la aritmética usa Decimal (decimal.js) — es una cadena de
// varios pasos (dividir, multiplicar, prorratear) y con `number` nativo
// es exactamente el tipo de cálculo donde se nota el error de float.
import Decimal from "decimal.js";

// Dado un mes/año, devuelve el semestre al que pertenece (1° o 2°) y sus
// fechas de inicio/fin — para poder consultar el histórico del semestre
// correcto sin hardcodear nada.
export function obtenerSemestre(fecha) {
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth() + 1; // 1-12
  if (mes <= 6) {
    return { numero: 1, desde: new Date(Date.UTC(anio, 0, 1)), hasta: new Date(Date.UTC(anio, 5, 30)) };
  }
  return { numero: 2, desde: new Date(Date.UTC(anio, 6, 1)), hasta: new Date(Date.UTC(anio, 11, 31)) };
}

export function calcularSAC({ mejorRemuneracionMensualDelSemestre, diasTrabajadosEnSemestre, diasDelSemestre }) {
  if (diasDelSemestre <= 0) return 0;

  const sacCompletoD = new Decimal(mejorRemuneracionMensualDelSemestre).times(0.5);
  const proporcionD = Decimal.min(1, new Decimal(diasTrabajadosEnSemestre).dividedBy(diasDelSemestre));

  return sacCompletoD.times(proporcionD).toDecimalPlaces(2).toNumber();
}
