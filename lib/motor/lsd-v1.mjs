// FM RRHH — formatos/lsd-v1.mjs
//
// Especificación DECLARATIVA del formato LSD (Libro de Sueldos Digital, ARCA).
// No inventada: cada campo, longitud y tipo de relleno se extrajo y verificó
// contra las fórmulas reales de 'Liquidacion_Sueldos_Multiconvenio_v9.xlsx',
// hoja 6.3_TXT_LSD (Registro 1 verificado incluso contra su longitud calculada
// en la celda I10 del Excel: dio 35, como exige la spec).
//
// Por qué esto vive separado del motor de reglas (ver 02-motor-de-reglas.md):
// cuando ARCA cambie el layout del LSD, se agrega un lsd-v2.mjs nuevo — no se
// toca ni el motor de cálculo ni este archivo. El exportador elige la versión
// vigente para el período que se está presentando.

const LSD_V1 = {
  version: "v1",
  fuente: "Derivado y verificado contra Liquidacion_Sueldos_Multiconvenio_v9.xlsx, hoja 6.3_TXT_LSD",
  nota: "Los nombres de campo son los que ya usaba el Excel original. Antes de usar esta " +
        "versión contra el instructivo oficial vigente de ARCA, validar con un contador matriculado " +
        "— el layout de LSD puede cambiar sin que este archivo se entere solo.",

  // ── Registro 1: cabecera del archivo, una única fila ──
  registro1: [
    { nombre: "Tipo de registro", longitud: 2, pad: "0", align: "izquierda", valor: () => "01" },
    { nombre: "CUIT empleador", longitud: 11, pad: "0", align: "derecha", valor: (ctx) => ctx.cuitEmpleador },
    { nombre: "Identificación de envío", longitud: 2, pad: " ", align: "derecha", valor: () => "SJ" },
    { nombre: "Período (AAAAMM)", longitud: 6, pad: "0", align: "derecha", valor: (ctx) => ctx.periodoAAAAMM },
    { nombre: "Tipo de liquidación", longitud: 1, pad: " ", align: "derecha", valor: (ctx) => ctx.tipoLiquidacion ?? "M" },
    { nombre: "N° de liquidación", longitud: 5, pad: "0", align: "derecha", valor: (ctx) => ctx.numeroLiquidacion ?? 1 },
    { nombre: "Días base", longitud: 2, pad: " ", align: "derecha", valor: (ctx) => ctx.diasBase ?? 30 },
    // OJO: este campo cuenta REGISTROS '04' (uno por trabajador con datos
    // para el F.931), NO registros '02' — corregido tras comparar contra
    // la especificación oficial vigente (LSDiseInterfazLiquidacion,
    // 15/05/2026). El nombre de la propiedad en el contexto (cantidadRegistros2)
    // quedó igual por compatibilidad, pero ahora SIEMPRE se le pasa la
    // cantidad de registros 04, no de registros 02 — ver motor-exportacion-lsd.mjs.
    { nombre: "Cantidad de Registro 4", longitud: 6, pad: "0", align: "derecha", valor: (ctx) => ctx.cantidadRegistros2 },
  ],

  // ── Registro 2: una fila por legajo liquidado en el período ──
  registro2: [
    { nombre: "Tipo de registro", longitud: 2, pad: "0", align: "izquierda", valor: () => "02" },
    { nombre: "CUIL", longitud: 11, pad: "0", align: "derecha", valor: (ctx) => ctx.cuil },
    { nombre: "Legajo", longitud: 10, pad: "0", align: "izquierda", valor: (ctx) => ctx.legajo },
    { nombre: "Dependencia / Revista", longitud: 50, pad: " ", align: "izquierda", valor: (ctx) => ctx.dependenciaRevista ?? "" },
    { nombre: "CBU", longitud: 22, pad: " ", align: "derecha", valor: (ctx) => ctx.cbu },
    { nombre: "Días para tope", longitud: 3, pad: "0", align: "derecha", valor: (ctx) => ctx.diasParaTope ?? 30 },
    { nombre: "Fecha de pago (AAAAMMDD)", longitud: 8, pad: "0", align: "derecha", valor: (ctx) => ctx.fechaPagoAAAAMMDD },
    { nombre: "Fecha de rúbrica", longitud: 8, pad: " ", align: "derecha", valor: (ctx) => ctx.fechaRubrica ?? "" },
    { nombre: "Forma de pago", longitud: 1, pad: "0", align: "derecha", valor: (ctx) => ctx.formaDePago ?? "3" }, // "3" es el valor que traía el legajo de ejemplo en el Excel original — el código de tabla (qué significa 1, 2, 3...) no está confirmado acá, validar contra el instructivo vigente de ARCA
  ],

  // ── Registro 3: una fila por concepto liquidado, por legajo ──
  registro3: [
    { nombre: "Tipo de registro", longitud: 2, pad: "0", align: "izquierda", valor: () => "03" },
    { nombre: "CUIL", longitud: 11, pad: "0", align: "derecha", valor: (ctx) => ctx.cuil },
    { nombre: "Código de concepto", longitud: 10, pad: "0", align: "izquierda", valor: (ctx) => ctx.codigoConcepto },
    { nombre: "Cantidad (x100)", longitud: 5, pad: "0", align: "derecha", valor: (ctx) => Math.round((ctx.cantidad ?? 0) * 100) },
    { nombre: "Unidades", longitud: 1, pad: " ", align: "izquierda", valor: (ctx) => ctx.unidades ?? "" },
    { nombre: "Importe (x100)", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round((ctx.importe ?? 0) * 100) },
    { nombre: "Débito / Crédito", longitud: 1, pad: " ", align: "izquierda", valor: (ctx) => ctx.debitoCredito ?? "D" },
    { nombre: "Período de ajuste", longitud: 6, pad: " ", align: "derecha", valor: (ctx) => ctx.periodoAjuste ?? "" },
  ],
  // ── Registro 4: datos del trabajador para el cálculo de la DJ F.931 —
  // agregado al comparar contra la especificación oficial vigente
  // (LSDiseInterfazLiquidacion, 15/05/2026) y encontrar que faltaba
  // completo. Bases imponibles 6, 7 y 10 son para casos especiales
  // (docentes/judiciales, regímenes de detracción específicos) que no
  // aplican a los convenios que maneja este sistema — van en 0 a
  // propósito, documentado, no por descuido.
  registro4: [
    { nombre: "Tipo de registro", longitud: 2, pad: "0", align: "izquierda", valor: () => "04" },
    { nombre: "CUIL", longitud: 11, pad: "0", align: "derecha", valor: (ctx) => ctx.cuil },
    { nombre: "Marca de cónyuge", longitud: 1, pad: "0", align: "derecha", valor: (ctx) => (ctx.tieneConyuge ? "1" : "0") },
    { nombre: "Cantidad de hijos", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.cantidadHijos ?? 0 },
    { nombre: "Marca trabajador en CCT", longitud: 1, pad: "0", align: "derecha", valor: () => "1" }, // todo legajo de este sistema tiene un convenio asignado
    { nombre: "Marca cobertura SCVO", longitud: 1, pad: "0", align: "derecha", valor: (ctx) => ctx.marcaScvo ?? "1" }, // Seguro Colectivo de Vida Obligatorio — mandatorio por ley, "1" salvo que se indique lo contrario
    { nombre: "Marca corresponde reducción", longitud: 1, pad: "0", align: "derecha", valor: (ctx) => ctx.marcaReduccion ?? "0" }, // regímenes de reducción de contribuciones (ej. Ley 26.940) — "0" salvo que la empresa tenga uno configurado, no construido todavía
    { nombre: "(reservado)", longitud: 1, pad: " ", align: "izquierda", valor: () => " " },
    { nombre: "Código tipo de operación", longitud: 1, pad: "0", align: "derecha", valor: (ctx) => ctx.codigoTipoOperacion ?? "0" },
    { nombre: "Código situación de revista", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.codigoSituacionRevista },
    { nombre: "Código de condición", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.codigoCondicion },
    { nombre: "Código de actividad", longitud: 3, pad: "0", align: "derecha", valor: (ctx) => ctx.codigoActividad },
    { nombre: "Código modalidad de contratación", longitud: 3, pad: "0", align: "derecha", valor: (ctx) => ctx.codigoModalidadContrato },
    { nombre: "Código de siniestrado", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.codigoSiniestrado ?? "" },
    { nombre: "Código de localidad", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.codigoLocalidad },
    { nombre: "Situación de revista 1", longitud: 2, pad: " ", align: "izquierda", valor: (ctx) => ctx.situacionRevista1 ?? "" },
    { nombre: "Día inicio situación 1", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.diaInicioSituacion1 ?? "" },
    { nombre: "Situación de revista 2", longitud: 2, pad: " ", align: "izquierda", valor: (ctx) => ctx.situacionRevista2 ?? "" },
    { nombre: "Día inicio situación 2", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.diaInicioSituacion2 ?? "" },
    { nombre: "Situación de revista 3", longitud: 2, pad: " ", align: "izquierda", valor: (ctx) => ctx.situacionRevista3 ?? "" },
    { nombre: "Día inicio situación 3", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.diaInicioSituacion3 ?? "" },
    { nombre: "Cantidad de días trabajados", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.diasTrabajados },
    { nombre: "Cantidad de horas trabajadas", longitud: 3, pad: "0", align: "derecha", valor: (ctx) => ctx.horasTrabajadas ?? 0 },
    { nombre: "% aporte adicional SS", longitud: 5, pad: "0", align: "derecha", valor: (ctx) => Math.round((ctx.porcentajeAporteAdicionalSS ?? 0) * 100) },
    { nombre: "% contribución tarea diferencial", longitud: 5, pad: "0", align: "derecha", valor: (ctx) => Math.round((ctx.porcentajeContribTareaDiferencial ?? 0) * 100) },
    { nombre: "Código de obra social", longitud: 6, pad: "0", align: "derecha", valor: (ctx) => ctx.codigoObraSocial },
    { nombre: "Cantidad de adherentes de obra social", longitud: 2, pad: "0", align: "derecha", valor: (ctx) => ctx.cantidadAdherentesOS ?? 0 },
    { nombre: "Aporte adicional de obra social", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round((ctx.aporteAdicionalOS ?? 0) * 100) },
    { nombre: "Contribución adicional de obra social", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round((ctx.contribAdicionalOS ?? 0) * 100) },
    { nombre: "Base dif. aporte OS y FSR", longitud: 15, pad: "0", align: "derecha", valor: () => 0 }, // caso especial, no aplica al caso general
    { nombre: "Base dif. contrib. OS y FSR", longitud: 15, pad: "0", align: "derecha", valor: () => 0 }, // caso especial, no aplica al caso general
    { nombre: "Base dif. Ley Riesgos del Trabajo", longitud: 15, pad: "0", align: "derecha", valor: () => 0 }, // caso especial, no aplica al caso general
    { nombre: "Remuneración maternidad ANSeS", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round((ctx.remuneracionMaternidad ?? 0) * 100) },
    { nombre: "Remuneración bruta", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round(ctx.remuneracionBruta * 100) },
    { nombre: "Base imponible 1 (aportes SIPA, topeada)", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round(ctx.baseImponible1 * 100) },
    { nombre: "Base imponible 2 (contrib. SIPA/INSSJP, sin tope)", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round(ctx.baseImponible2 * 100) },
    { nombre: "Base imponible 3 (contrib. FNE/AAFF/RENATRE)", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round(ctx.baseImponible3 * 100) },
    { nombre: "Base imponible 4 (aporte obra social, topeada)", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round(ctx.baseImponible4 * 100) },
    { nombre: "Base imponible 5 (contrib. patronal obra social)", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round(ctx.baseImponible5 * 100) },
    { nombre: "Base imponible 6 (aportes diferenciales — caso especial)", longitud: 15, pad: "0", align: "derecha", valor: () => 0 },
    { nombre: "Base imponible 7 (caso especial)", longitud: 15, pad: "0", align: "derecha", valor: () => 0 },
    { nombre: "Base imponible 8 (ART)", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round(ctx.baseImponible8 * 100) },
    { nombre: "Base imponible 9", longitud: 15, pad: "0", align: "derecha", valor: (ctx) => Math.round((ctx.baseImponible9 ?? 0) * 100) },
    { nombre: "Base dif. aporte Seg. Social", longitud: 15, pad: "0", align: "derecha", valor: () => 0 }, // caso especial, no aplica al caso general
    { nombre: "Base dif. contrib. Seg. Social", longitud: 15, pad: "0", align: "derecha", valor: () => 0 }, // caso especial, no aplica al caso general
    { nombre: "Base imponible 10 (detracción Ley 27.430 — caso especial)", longitud: 15, pad: "0", align: "derecha", valor: () => 0 },
    { nombre: "Importe a detraer (Ley 27.541)", longitud: 15, pad: "0", align: "derecha", valor: () => 0 }, // no construido — requiere el régimen de reducción configurado por empresa
  ],
};

export { LSD_V1 };
