// FM RRHH — lib/motor/motor-embargos.mjs
//
// Igual que motor-reglas.mjs: toda la aritmética interna usa Decimal
// (decimal.js), no `number` nativo — para que una cadena de cuentas (acá,
// corta, pero igual de real) no arrastre el error clásico de float de JS.
// Quien llama a estas funciones sigue pasando y recibiendo `number`
// normales — la conversión es interna, invisible desde afuera.
//
// Dos mecanismos DISTINTOS, con reglas legales distintas (Decreto 484/87):
//
// 1. Embargo JUDICIAL (cuota alimentaria / litis expensas): el art. 4 del
//    Decreto 484/87 EXCLUYE EXPLÍCITAMENTE estos casos del tope general —
//    el % lo fija el juez, buscando la subsistencia del alimentante, y
//    puede ser mayor a lo que un embargo común permitiría. NO se valida
//    contra ningún tope acá — sería jurídicamente incorrecto.
//
// 2. Embargo COMERCIAL (deuda común): SÍ tiene un tope legal, escalonado
//    según el SMVM (Salario Mínimo, Vital y Móvil):
//      - Hasta 1 SMVM: inembargable.
//      - Entre 1 y 2 SMVM: hasta 10% del excedente sobre 1 SMVM.
//      - Por encima de 2 SMVM: hasta 20% del excedente sobre 2 SMVM
//        (además del 10% de la franja anterior).
//    Fernando carga los importes mes a mes a mano (no un %) — esta
//    función se usa para AVISAR si algún importe cargado supera el tope
//    legal, no para calcularlo de forma automática ni para bloquearlo.
import Decimal from "decimal.js";

export function calcularTopeEmbargoComercial(remuneracionBruta, smvm) {
  const bruto = new Decimal(remuneracionBruta);
  const s = new Decimal(smvm);
  if (bruto.lessThanOrEqualTo(s)) return 0;

  const excedenteHasta2SMVM = Decimal.min(bruto, s.times(2)).minus(s);
  const excedenteSobre2SMVM = Decimal.max(0, bruto.minus(s.times(2)));

  return excedenteHasta2SMVM.times(0.1).plus(excedenteSobre2SMVM.times(0.2)).toDecimalPlaces(2).toNumber();
}

// Embargo judicial: % dictado por el juez, aplicado sobre el neto DESPUÉS
// de todo lo demás (aportes, Ganancias si corresponde) — es la última
// retención de la cadena.
export function calcularEmbargoJudicial(netoPreEmbargos, porcentaje) {
  const neto = new Decimal(netoPreEmbargos);
  const pct = new Decimal(porcentaje).dividedBy(100);
  return Decimal.max(0, neto.times(pct)).toDecimalPlaces(2).toNumber();
}

// ── Prioridades y límite conjunto (agregado — documento de mejora,
// "Ganancias y embargos") ──
//
// Hasta acá, judicial y comercial se calculaban cada uno POR SEPARADO
// contra el mismo neto — lo cual está bien si hay uno solo, pero es
// incorrecto si un legajo tiene LOS DOS a la vez y el sueldo no alcanza
// para cubrir ambos completos.
//
// La regla legal, confirmada en múltiples fuentes ("las deudas
// alimentarias tienen carácter preferencial"): la cuota alimentaria
// (judicial) tiene PRIORIDAD sobre cualquier embargo comercial. Si no
// alcanza, el comercial cede el lugar — nunca al revés.
//
// Esta función procesa TODOS los embargos activos de un legajo JUNTOS,
// en ese orden de prioridad, y nunca deja que la suma supere el neto
// disponible (evita el caso real que podía pasar antes: descontar más
// del 100% del neto sin darse cuenta si coexistían los dos tipos).
//
// Hay una mención (art. 734 CPCCN) a un tope combinado del 50%-70% del
// neto que NO se validó con la misma certeza que la prioridad en sí —
// por eso esto AVISA si el total supera el 50%, en vez de aplicar un
// tope que no está 100% confirmado. Mejor que lo revise un abogado en
// ese caso puntual que arriesgar aplicar mal una regla incierta.
export function procesarEmbargosDelLegajo({ netoPreEmbargos, embargosJudiciales = [], embargoComercialSolicitado = 0 }) {
  let netoDisponible = new Decimal(netoPreEmbargos);
  let totalJudicialD = new Decimal(0);

  for (const ej of embargosJudiciales) {
    const importe = calcularEmbargoJudicial(netoDisponible.toNumber(), ej.porcentaje);
    totalJudicialD = totalJudicialD.plus(importe);
    netoDisponible = netoDisponible.minus(importe);
  }

  const comercialSolicitadoD = new Decimal(embargoComercialSolicitado);
  const comercialAplicadoD = Decimal.min(comercialSolicitadoD, Decimal.max(0, netoDisponible)).toDecimalPlaces(2);

  const totalEmbargadoD = totalJudicialD.plus(comercialAplicadoD);
  const advertencias = [];

  if (comercialAplicadoD.lessThan(comercialSolicitadoD)) {
    advertencias.push(
      `El embargo comercial pedía $${comercialSolicitadoD.toFixed(2)} pero solo se pudo aplicar $${comercialAplicadoD.toFixed(2)} — la cuota alimentaria tiene prioridad legal y ya consumió el resto del neto disponible.`
    );
  }
  if (netoPreEmbargos > 0 && totalEmbargadoD.dividedBy(netoPreEmbargos).greaterThan(0.5)) {
    const pct = totalEmbargadoD.dividedBy(netoPreEmbargos).times(100).toFixed(1);
    advertencias.push(
      `El total embargado este mes es el ${pct}% del neto — hay una referencia (art. 734 CPCCN) a un tope combinado del 50-70% que conviene confirmar con un abogado antes de aplicar esto; no se validó automáticamente.`
    );
  }

  return {
    totalJudicial: totalJudicialD.toNumber(),
    comercialAplicado: comercialAplicadoD.toNumber(),
    totalEmbargado: totalEmbargadoD.toNumber(),
    advertencias,
  };
}
