// FM RRHH — catalogo-conceptos.mjs
//
// Fernando (Tango) enumeraba las fórmulas con un número, agrupado por rango
// según el tipo de concepto (remunerativos en un bloque, no remunerativos en
// otro, bases imponibles en otro). Acá NO se hardcodean esos rangos — se
// cargan como datos (RangoNumeracion en el schema), porque los números
// concretos varían por instalación y porque inventarlos sería peor que no
// tenerlos. Lo único fijo es el mecanismo: validar que un número entre en el
// rango de su tipo, y sugerir el próximo libre.

/**
 * @param {number} numero
 * @param {string} tipo - 'remunerativo' | 'no_remunerativo' | 'descuento'
 * @param {Array} rangos - [{ tipo, desde, hasta }] — configurado por el estudio
 */
function validarNumeroConcepto(numero, tipo, rangos, conceptosExistentes = []) {
  const errores = [];

  const rango = rangos.find((r) => r.tipo === tipo);
  if (!rango) {
    errores.push(`No hay un rango de numeración configurado para conceptos de tipo "${tipo}". Configurarlo antes de asignar números.`);
    return { ok: false, errores };
  }

  if (!Number.isInteger(numero)) {
    errores.push(`"${numero}" no es un número entero.`);
  } else if (numero < rango.desde || numero > rango.hasta) {
    errores.push(`El número ${numero} está fuera del rango configurado para "${tipo}" (${rango.desde}–${rango.hasta}).`);
  }

  const enUso = conceptosExistentes.find((c) => c.numero === numero);
  if (enUso) {
    errores.push(`El número ${numero} ya está en uso por el concepto "${enUso.codigo}" (${enUso.nombre}).`);
  }

  return { ok: errores.length === 0, errores };
}

/**
 * Sugiere el próximo número libre dentro del rango configurado para el tipo,
 * en orden ascendente — no es obligatorio usarlo, es una sugerencia editable.
 */
function sugerirProximoNumero(tipo, rangos, conceptosExistentes = []) {
  const rango = rangos.find((r) => r.tipo === tipo);
  if (!rango) return null;

  const enUso = new Set(conceptosExistentes.filter((c) => c.numero != null).map((c) => c.numero));
  for (let n = rango.desde; n <= rango.hasta; n++) {
    if (!enUso.has(n)) return n;
  }
  return null; // rango agotado — el estudio necesita ampliar el rango configurado
}

export { validarNumeroConcepto, sugerirProximoNumero };
