// FM RRHH — parametros-topes.mjs
//
// El problema real que describiste: cada mes hay que actualizar el tope
// jubilatorio (y otros) antes de liquidar, y en el Excel eso vive suelto en
// una celda que hay que acordarse de tocar. Acá es una tabla versionada por
// vigencia — igual que las escalas — así que:
//   1. Nunca se pisa el valor viejo (queda el historial completo).
//   2. Liquidar un período retroactivo usa el tope que estaba vigente EN ESE
//      MES, no el de hoy.
//   3. El motor de reglas los lee vía TOPE('CLAVE'), nunca hardcodeados en
//      una fórmula.

/**
 * @param {string} clave
 * @param {Date} fecha - fecha del período que se está liquidando
 * @param {Array} parametros - [{ clave, valor, vigenciaDesde, vigenciaHasta }]
 */
function obtenerParametroVigente(clave, fecha, parametros) {
  const candidatos = parametros
    .filter((p) => p.clave === clave)
    .filter((p) => p.vigenciaDesde <= fecha && (!p.vigenciaHasta || p.vigenciaHasta >= fecha))
    .sort((a, b) => b.vigenciaDesde - a.vigenciaDesde);
  return candidatos[0] ?? null;
}

/**
 * Arma el objeto `topes` que espera liquidarLegajo() ({ CLAVE: valor }),
 * para un conjunto de claves y una fecha de período dada. Si falta alguna,
 * la deja afuera del objeto a propósito — el motor de reglas ya sabe fallar
 * con un mensaje claro si una fórmula la referencia y no está.
 */
function armarContextoTopes(claves, fecha, parametros) {
  const contexto = {};
  const faltantes = [];
  for (const clave of claves) {
    const p = obtenerParametroVigente(clave, fecha, parametros);
    if (p) contexto[clave] = Number(p.valor);
    else faltantes.push(clave);
  }
  return { contexto, faltantes };
}

/**
 * Actualiza un parámetro: cierra la vigencia del valor anterior (si había)
 * y crea uno nuevo. Nunca hace UPDATE sobre el valor viejo — eso rompería el
 * historial y una liquidación retroactiva ya cerrada quedaría mal si alguien
 * vuelve a auditarla.
 */
function actualizarParametro(clave, valorNuevo, vigenciaDesde, parametrosExistentes, fuente = null) {
  const vigenteActual = parametrosExistentes.find((p) => p.clave === clave && !p.vigenciaHasta);

  const actualizados = parametrosExistentes.map((p) => {
    if (p === vigenteActual) {
      // el nuevo valor rige desde vigenciaDesde — el anterior cierra un día antes
      const cierre = new Date(vigenciaDesde);
      cierre.setDate(cierre.getDate() - 1);
      return { ...p, vigenciaHasta: cierre };
    }
    return p;
  });

  actualizados.push({ clave, valor: valorNuevo, vigenciaDesde, vigenciaHasta: null, fuente });
  return actualizados;
}

export { obtenerParametroVigente, armarContextoTopes, actualizarParametro };
