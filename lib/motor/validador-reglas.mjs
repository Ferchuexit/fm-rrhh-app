// FM RRHH — validador-reglas.mjs
//
// Hoy motor-reglas.mjs detecta un ciclo de dependencias recién AL LIQUIDAR —
// que es tarde: significa que alguien cargó mal una regla hace semanas y
// nadie se enteró hasta el día del cierre. Este módulo corre la misma
// detección, pero en el momento de GUARDAR la regla desde la UI — antes de
// que el problema llegue a afectar una liquidación real.
//
// Reutiliza el parser y el ordenTopologico ya probados en motor-reglas.mjs
// (tokenize/parse para sintaxis, ordenTopologico para ciclos) — no duplica
// esa lógica, la reusa contra el conjunto de reglas que quedaría DESPUÉS de
// guardar el cambio, no contra el estado actual.

import { tokenize, parse, extraerDependencias, extraerTopesReferenciados, ordenTopologico } from "./motor-reglas.mjs";

/**
 * @param {object} reglaNueva - { conceptoCodigo, convenioId, formula, aporta, contribuye }
 * @param {Array} reglasExistentes - todas las reglas ya guardadas (de cualquier convenio)
 * @param {Array} conceptosCatalogo - [{ codigo }] — para detectar referencias a conceptos que no existen
 * @param {Array} insumosDirectos - códigos de concepto que son insumo directo (no tienen regla, ver 02-motor-de-reglas.md)
 */
function validarReglaAntesDeGuardar(reglaNueva, reglasExistentes, conceptosCatalogo, insumosDirectos = [], clavesTopesConocidas = []) {
  const errores = [];
  const advertencias = [];

  // 1. Sintaxis de la fórmula — antes que nada, si esto falla no tiene sentido seguir
  try {
    parse(tokenize(reglaNueva.formula));
  } catch (e) {
    errores.push({ tipo: "sintaxis", mensaje: e.message });
    return { ok: false, errores, advertencias }; // sin fórmula válida, no se puede seguir validando
  }

  // 2. Referencias a CONCEPTO('X') que no existen ni como regla ni como insumo
  const codigosValidos = new Set([
    ...reglasExistentes.map((r) => r.conceptoCodigo),
    ...conceptosCatalogo.map((c) => c.codigo),
    ...insumosDirectos,
    reglaNueva.conceptoCodigo,
  ]);
  for (const dep of extraerDependencias(reglaNueva.formula)) {
    if (!codigosValidos.has(dep)) {
      advertencias.push({
        tipo: "concepto_no_encontrado",
        mensaje: `La fórmula referencia CONCEPTO('${dep}'), que no existe en el catálogo ni tiene una regla cargada. Si es un typo, corregilo; si el concepto todavía no existe, esta regla va a fallar al liquidar.`,
      });
    }
  }

  // 2b. Referencias a TOPE('X') que no están en el catálogo de parámetros vigentes
  const clavesTopesSet = new Set(clavesTopesConocidas);
  for (const clave of extraerTopesReferenciados(reglaNueva.formula)) {
    if (!clavesTopesSet.has(clave)) {
      advertencias.push({
        tipo: "tope_no_encontrado",
        mensaje: `La fórmula referencia TOPE('${clave}'), que no está cargado en Parámetros y Topes. Si es un typo, corregilo; si el parámetro todavía no existe, esta regla va a fallar al liquidar.`,
      });
    }
  }

  // 3. Ciclos — se arma el conjunto de reglas COMO QUEDARÍA después de guardar
  //    (reemplazando la regla existente del mismo concepto+convenio si la había,
  //    para no contar la versión vieja y la nueva como si fueran dos nodos distintos)
  const reglasDelConvenio = reglasExistentes.filter(
    (r) => r.convenioId === reglaNueva.convenioId && r.conceptoCodigo !== reglaNueva.conceptoCodigo
  );
  const conjuntoFinal = [...reglasDelConvenio, reglaNueva];

  try {
    const orden = ordenTopologico(conjuntoFinal);
    return { ok: errores.length === 0, errores, advertencias, ordenResultante: orden };
  } catch (e) {
    errores.push({ tipo: "ciclo", mensaje: e.message });
    return { ok: false, errores, advertencias };
  }
}

export { validarReglaAntesDeGuardar };
