// FM RRHH — validador-novedades.mjs
// Valida un lote de novedades importadas ANTES de que toquen la tabla `novedades`
// en estado `valida`. Nada entra a liquidar sin pasar por acá.
//
// Filosofía: cada fila se valida de forma independiente y acumula TODOS los errores
// que tenga (no corta en el primero), para que el reporte le diga al usuario todo lo
// que hay que corregir en una sola pasada, no una por una.

const CAMPOS_REQUERIDOS = ["legajoNumero", "fecha", "conceptoCodigo"];

// Rangos razonables por unidad de concepto — configurable por instalación.
// Default — se usa si no hay un rango específico para el convenio del legajo.
// Nunca hardcodeado como única fuente: se puede pisar por convenio vía
// `context.rangosPorConvenio`, mismo principio que reglas_concepto en el motor
// de reglas (parametrizable, no "if convenio === X").
const RANGO_POR_UNIDAD_DEFAULT = {
  horas: { min: 0, max: 200 }, // más de 200hs en un período es sospechoso, no imposible
  monto: { min: -500000, max: 5000000 }, // negativo permitido (ej. descuentos), pero acotado
  porcentaje: { min: 0, max: 100 },
};

function rangoPara(unidad, convenioId, rangosPorConvenio) {
  const override = rangosPorConvenio?.[convenioId]?.[unidad];
  return override ?? RANGO_POR_UNIDAD_DEFAULT[unidad];
}

function parseFechaISO(f) {
  if (!(f instanceof Date)) {
    if (typeof f !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
    const d = new Date(f + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  return isNaN(f.getTime()) ? null : f;
}

/**
 * @param {Array} filas - [{ legajoNumero, fecha, conceptoCodigo, cantidad?, valor? }]
 * @param {object} context
 * @param {Array} context.legajos - [{ numero, condicion, convenioId, fechaEgreso }]
 * @param {Array} context.conceptos - [{ codigo, unidad }]
 * @param {Set<string>} context.reglasConvenioConcepto - set de "convenioId|conceptoCodigo" válidos
 * @param {{desde: Date, hasta: Date}} context.periodo - rango de fechas del período que se está liquidando
 * @param {Array} context.novedadesExistentes - [{ legajoNumero, conceptoCodigo, fecha }] ya cargadas en el período (para detectar duplicados contra la base, no solo dentro del archivo)
 */
function validarNovedades(filas, context) {
  const { legajos, conceptos, reglasConvenioConcepto, periodo, novedadesExistentes = [], rangosPorConvenio = {} } = context;

  const legajoPorNumero = new Map(legajos.map((l) => [l.numero, l]));
  const conceptoPorCodigo = new Map(conceptos.map((c) => [c.codigo, c]));

  const clavesVistas = new Set(); // detecta duplicados DENTRO del propio archivo
  const clavesExistentes = new Set(
    novedadesExistentes.map((n) => `${n.legajoNumero}|${n.conceptoCodigo}|${n.fecha}`)
  );

  const resultado = filas.map((fila, idx) => {
    const errores = [];
    const numeroFila = idx + 2; // +2: fila 1 es encabezado en el Excel

    // 1. Campos requeridos presentes
    for (const campo of CAMPOS_REQUERIDOS) {
      if (fila[campo] === undefined || fila[campo] === null || fila[campo] === "") {
        errores.push(`Falta el campo "${campo}"`);
      }
    }
    if (errores.length) return { fila: numeroFila, ...fila, estado: "con_error", errores };

    // 2. Legajo inexistente
    const legajo = legajoPorNumero.get(Number(fila.legajoNumero));
    if (!legajo) {
      errores.push(`Legajo ${fila.legajoNumero} no existe en esta empresa`);
    }

    // 3. Fecha inválida (formato) o fuera del período que se está liquidando
    const fecha = parseFechaISO(fila.fecha);
    if (!fecha) {
      errores.push(`Fecha "${fila.fecha}" inválida (formato esperado AAAA-MM-DD)`);
    } else if (periodo && (fecha < periodo.desde || fecha > periodo.hasta)) {
      errores.push(
        `Fecha ${fila.fecha} fuera del período que se está liquidando (${periodo.desde.toISOString().slice(0, 10)} a ${periodo.hasta.toISOString().slice(0, 10)})`
      );
    }

    // 4. Concepto inexistente
    const concepto = conceptoPorCodigo.get(fila.conceptoCodigo);
    if (!concepto) {
      errores.push(`Concepto "${fila.conceptoCodigo}" no existe en el catálogo`);
    }

    // A partir de acá, varias validaciones necesitan legajo Y concepto resueltos
    if (legajo && concepto) {
      // 5. Convenio incorrecto: el concepto no tiene regla para el convenio del legajo
      const clave = `${legajo.convenioId}|${concepto.codigo}`;
      if (!reglasConvenioConcepto.has(clave)) {
        errores.push(
          `El concepto "${concepto.codigo}" no está parametrizado para el convenio del legajo ${legajo.numero}`
        );
      }

      // 7. Valores fuera de rango — el rango depende del convenio del legajo,
      // no es un único valor global (ver rangoPara() arriba)
      const rango = rangoPara(concepto.unidad, legajo.convenioId, rangosPorConvenio);
      const valorNumerico = fila.cantidad ?? fila.valor;
      if (rango && valorNumerico !== undefined) {
        const v = Number(valorNumerico);
        if (Number.isNaN(v)) {
          errores.push(`Valor "${valorNumerico}" no es numérico`);
        } else if (v < rango.min || v > rango.max) {
          errores.push(`Valor ${v} fuera de rango razonable para ${concepto.unidad} (${rango.min} a ${rango.max})`);
        }
      }
    }

    // 6. Empleado dado de baja antes de la fecha de la novedad
    if (legajo && fecha && legajo.condicion === "baja" && legajo.fechaEgreso && fecha > new Date(legajo.fechaEgreso)) {
      errores.push(`El legajo ${legajo.numero} está dado de baja desde ${legajo.fechaEgreso}`);
    }

    // 8. Duplicación — dentro del archivo o contra lo ya cargado en el período
    if (legajo && concepto && fecha) {
      const clave = `${legajo.numero}|${concepto.codigo}|${fila.fecha}`;
      if (clavesVistas.has(clave)) {
        errores.push(`Novedad duplicada dentro del archivo (mismo legajo, concepto y fecha)`);
      } else if (clavesExistentes.has(clave)) {
        errores.push(`Ya existe una novedad cargada para este legajo/concepto/fecha en este período`);
      }
      clavesVistas.add(clave);
    }

    return {
      fila: numeroFila,
      ...fila,
      estado: errores.length ? "con_error" : "valida",
      errores,
    };
  });

  const validas = resultado.filter((r) => r.estado === "valida");
  const conError = resultado.filter((r) => r.estado === "con_error");

  return {
    filas: resultado,
    resumen: { total: resultado.length, validas: validas.length, conError: conError.length },
  };
}

export { validarNovedades };
