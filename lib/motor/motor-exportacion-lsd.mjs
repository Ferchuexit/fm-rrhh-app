// FM RRHH — motor-exportacion-lsd.mjs
//
// Motor GENÉRICO: no sabe nada de "CUIL" ni de "Legajo" — solo sabe renderizar
// campos de ancho fijo a partir de una especificación declarativa (ver
// formatos/lsd-v1.mjs). Separado del motor de reglas a propósito: acá no se
// calcula ningún importe, solo se da formato a lo que el motor de reglas ya
// calculó.
//
// Decisión de diseño clave: si un valor no entra en el ancho del campo, ESTO
// FALLA — no trunca en silencio. Un CUIL truncado o un importe cortado que
// termina presentado ante ARCA es un incidente de compliance, no un detalle
// estético. Mejor que la generación del archivo se detenga con un error claro.

function campoFijo(valorCrudo, { longitud, pad, align }, nombreCampo) {
  const s = String(valorCrudo ?? "");
  if (s.length > longitud) {
    throw new Error(
      `Campo "${nombreCampo}" excede su longitud fija: valor "${s}" (${s.length} caracteres) > ${longitud} permitidos. ` +
      `No se genera el archivo — corregir el dato de origen antes de reintentar.`
    );
  }
  const relleno = pad.repeat(longitud - s.length);
  return align === "derecha" ? relleno + s : s + relleno;
}

function renderizarRegistro(spec, contexto) {
  return spec
    .map((campo) => {
      const valorCrudo = typeof campo.valor === "function" ? campo.valor(contexto) : contexto[campo.valor];
      return campoFijo(valorCrudo, campo, campo.nombre);
    })
    .join("");
}

function longitudEsperada(spec) {
  return spec.reduce((acc, campo) => acc + campo.longitud, 0);
}

/**
 * @param {object} formato - LSD_V1 (o la versión vigente) de formatos/lsd-vN.mjs
 * @param {object} p
 * @param {object} p.empresa - { cuit }
 * @param {object} p.periodo - { aaaammm: '202607' }
 * @param {Array} p.legajos - [{ cuil, legajo, dependenciaRevista, cbu, fechaPagoAAAAMMDD, ... }]
 * @param {Array} p.conceptosPorLegajo - [{ cuil, codigoConcepto, cantidad, unidades, importe, debitoCredito }]
 * @param {Array} [p.trabajadoresF931] - [{ cuil, tieneConyuge, cantidadHijos, diasTrabajados,
 *   remuneracionBruta, baseImponible1..9, codigoSituacionRevista, codigoCondicion,
 *   codigoModalidadContrato, codigoActividad, codigoLocalidad, codigoObraSocial, ... }]
 *   — Registro 4, opcional: si no se pasa, el archivo se genera SIN registros 04
 *   (compatibilidad con quien todavía no cargó los códigos de clasificación ARCA).
 */
function generarArchivoLSD(formato, { empresa, periodo, legajos, conceptosPorLegajo, trabajadoresF931 = [] }) {
  const lineas = [];

  const registro1Ctx = {
    cuitEmpleador: empresa.cuit,
    periodoAAAAMM: periodo.aaaammm,
    cantidadRegistros2: trabajadoresF931.length, // ahora cuenta registros 04, ver nota en lsd-v1.mjs
  };
  const linea1 = renderizarRegistro(formato.registro1, registro1Ctx);
  lineas.push(linea1);

  for (const legajo of legajos) {
    lineas.push(renderizarRegistro(formato.registro2, { cuitEmpleador: empresa.cuit, ...legajo }));
  }

  for (const concepto of conceptosPorLegajo) {
    lineas.push(renderizarRegistro(formato.registro3, concepto));
  }

  for (const trabajador of trabajadoresF931) {
    lineas.push(renderizarRegistro(formato.registro4, trabajador));
  }

  return {
    contenido: lineas.join("\r\n"),
    lineas: lineas.length,
    longitudesEsperadas: {
      registro1: longitudEsperada(formato.registro1),
      registro2: longitudEsperada(formato.registro2),
      registro3: longitudEsperada(formato.registro3),
      registro4: longitudEsperada(formato.registro4),
    },
  };
}

export { campoFijo, renderizarRegistro, longitudEsperada, generarArchivoLSD };
