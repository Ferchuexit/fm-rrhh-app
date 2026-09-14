// FM RRHH — lib/motor/motor-docentes-pba.mjs
//
// Motor puro (sin Prisma) para Docentes PBA — Fase 1: Maestro de Grado y
// Preceptor (Primaria y Secundaria, "cargo"), y Profesor (Secundaria,
// "hora_catedra"). Todo confirmado al centavo contra la calculadora
// oficial de FEB (calculadora.feb.org.ar), período agosto 2026 — ver chat
// 12-14/09/2026 para el detalle de cada caso usado.
//
// Jornada Completa Y Jornada Extendida están resueltas y confirmadas para
// los cargos de Primaria y Secundaria (438/455/2575 son fijos, siempre
// ×2, sin importar la modalidad; 641/653 son fijos para Preceptor, y 641
// escala con las unidades reales SOLO para Maestro de Grado — ver
// multiplicador641()). Zona desfavorable con sus 5 niveles reales
// también resuelta — ver buscarPorcentajeZona().
//
// ALCANCE DE FASE 1 (lo que sigue pendiente, a propósito, no es un olvido):
//   - GARANTÍA (pisos mínimos históricos, "MAR/2007"/"730") no está
//     implementada — es un mecanismo de piso con tabla propia, no una
//     corrección chica. Documentado, no escondido.
import Decimal from "decimal.js";

const TASA_IPS = 0.16;
const TASA_IOMA = 0.048;

// 641 es el único concepto confirmado que varía por CARGO — Preceptor
// cobra siempre el valor base (el que vive en DocValorConcepto), fijo,
// sin importar la modalidad. Maestro de Grado en cambio SÍ escala con
// las unidades reales de la modalidad (Completa=2, Extendida=1,75) —
// confirmado con los 4 casos posibles (2 cargos × 2 modalidades):
// 234.294,31 × 2 = 468.588,62 y 234.294,31 × 1,75 = 410.015,04, exacto.
function multiplicador641(cargo) {
  if (cargo.nombre === "Maestro de Grado") return Number(cargo.unidades);
  return 1;
}

// Cuánto multiplica un concepto 'fijo_por_unidad' — distinto según tipo
// de cargo:
//   - hora_catedra (Profesor): se recalcula con el mismo divisor que el
//     BASICO — confirmado con 455 en 4 y 8 horas, exacto.
//   - 'cargo', concepto 641: caso especial, ver multiplicador641().
//   - 'cargo', el resto (438/455/2575): SIEMPRE ×2 en Jornada Completa Y
//     Extendida (no escala con las unidades reales del cargo — quedan
//     agrupadas en la misma categoría). Confirmado: el valor guardado es
//     la mitad ($141.881 para 455, no $283.762) — el ×2 vive acá, no en
//     el dato, porque si no hora_catedra lo hereda sin querer.
function multiplicadorFijo(concepto, cargo, cantidadModulos) {
  if (cargo.tipo === "hora_catedra") {
    return new Decimal(cantidadModulos).dividedBy(cargo.divisorHoraCatedra ?? 1).toNumber();
  }
  if (concepto.codigo === "641") return multiplicador641(cargo);
  // 653 (Bonif Preceptores ESB/Polimodal/Adultos) — el equivalente de 641
  // pero para Preceptor en Secundaria. Confirmado con 2 casos reales
  // (Jornada Completa Y Extendida dan exactamente $399.174,56): fijo,
  // no escala con la modalidad — igual patrón que 641 en Preceptor.
  if (concepto.codigo === "653") return 1;
  return 2;
}

/**
 * BASICO para un cargo (Maestro/Preceptor) = índice × valor del punto de
 * índice × unidades de la designación (Jornada Completa = 2, Extendida =
 * 1,75...). Confirmado exacto, ambos cargos, ambas modalidades.
 */
export function calcularBasico({ indice, valorPorIndice, unidades }) {
  return new Decimal(indice).times(valorPorIndice).times(unidades).toDecimalPlaces(2).toNumber();
}

/**
 * BASICO para hora_catedra (Profesor) = (valor del punto de índice /
 * divisor) × cantidad de horas cátedra. Usa un divisor entero (15) en
 * vez de guardar el índice como fracción (1/15) — guardarlo como decimal
 * de 4 cifras redondeaba mal y daba un básico ~$35 más alto que el real.
 */
export function calcularBasicoHoraCatedra({ valorPorIndice, divisorHoraCatedra, cantidadModulos }) {
  return new Decimal(valorPorIndice).dividedBy(divisorHoraCatedra).times(cantidadModulos).toDecimalPlaces(2).toNumber();
}

/**
 * Busca el tramo de antigüedad vigente — el de mayor aniosDesde que sea
 * <= a la antigüedad real del docente. Tabla completa y sin huecos,
 * verificada con 13 casos reales (ver DocTramoAntiguedad).
 */
export function buscarPorcentajeAntiguedad(aniosAntiguedad, tramos) {
  const ordenados = [...tramos].sort((a, b) => a.aniosDesde - b.aniosDesde);
  let aplicable = ordenados[0] ?? { porcentaje: 0 };
  for (const tramo of ordenados) {
    if (tramo.aniosDesde <= aniosAntiguedad) aplicable = tramo;
    else break;
  }
  return aplicable.porcentaje;
}

/** ANTIGUEDAD = BASICO × % del tramo vigente. */
export function calcularAntiguedad({ basico, aniosAntiguedad, tramos }) {
  const porcentaje = buscarPorcentajeAntiguedad(aniosAntiguedad, tramos);
  return new Decimal(basico).times(porcentaje).dividedBy(100).toDecimalPlaces(2).toNumber();
}

/** ¿Este concepto corresponde para este nivel/cargo? null = aplica a todos. */
export function conceptoAplica({ concepto, nivel, cargoNombre }) {
  if (concepto.aplicaANivel && concepto.aplicaANivel !== nivel) return false;
  if (concepto.aplicaACargoNombre && concepto.aplicaACargoNombre !== cargoNombre) return false;
  return true;
}

/**
 * Importe de un concepto puntual, ya confirmado que aplica.
 *   'fijo_por_unidad'   → el valor guardado, tal cual (Fase 1 = Jornada
 *                          Completa) — con la excepción documentada de
 *                          641 según el cargo.
 *   'porcentaje_basico' → % del BASICO.
 *   'fijo_total'        → el valor guardado, sin ninguna variación.
 */
export function calcularImporteConcepto({ concepto, basico, cargoNombre, cargoTipo = "cargo", unidadesCargo = 1, cantidadModulos = 1, divisorHoraCatedra = null }) {
  if (concepto.modoCalculo === "porcentaje_basico") {
    return new Decimal(basico).times(concepto.valor).dividedBy(100).toDecimalPlaces(2).toNumber();
  }
  if (concepto.modoCalculo === "fijo_por_unidad") {
    const multiplicador = multiplicadorFijo(concepto, { nombre: cargoNombre, tipo: cargoTipo, unidades: unidadesCargo, divisorHoraCatedra }, cantidadModulos);
    return new Decimal(concepto.valor).times(multiplicador).toDecimalPlaces(2).toNumber();
  }
  if (concepto.modoCalculo === "fijo_total") {
    return new Decimal(concepto.valor).toDecimalPlaces(2).toNumber();
  }
  throw new Error(`modoCalculo desconocido: "${concepto.modoCalculo}" (concepto ${concepto.codigo})`);
}

/** IPS 16% + IOMA 4,8% — confirmado al centavo sobre la base aportable (todo menos 2575/FONID). */
export function calcularAportes(baseAportable) {
  const baseD = new Decimal(baseAportable);
  return {
    ips: baseD.times(TASA_IPS).toDecimalPlaces(2).toNumber(),
    ioma: baseD.times(TASA_IOMA).toDecimalPlaces(2).toNumber(),
  };
}

/**
 * % del concepto 624 (RURAL) según el nivel de zona desfavorable —
 * confirmado con 5 casos reales, mismo legajo base, solo variando el
 * nivel: 30/60/90/100/120%. null o sin tramo cargado = 0%.
 */
export function buscarPorcentajeZona(nivel, tramosZona) {
  if (!nivel) return 0;
  const tramo = tramosZona.find((t) => t.nivel === nivel);
  return tramo ? Number(tramo.porcentaje) : 0;
}

/**
 * Liquida UNA designación completa — junta BASICO, ANTIGUEDAD y los
 * conceptos aplicables, y calcula IPS/IOMA sobre la base correcta.
 * Función pura: no consulta la base, todo lo que necesita se lo pasan
 * ya resuelto (cargo, conceptos, tramos).
 *
 * @param {object} cargo - { nombre, nivel, modalidad, indice, unidades, tipo, divisorHoraCatedra }
 * @param {number} valorPorIndice
 * @param {number} aniosAntiguedad
 * @param {object[]} tramosAntiguedad
 * @param {object[]} conceptos - catálogo completo con su valor vigente ya resuelto
 * @param {number|null} zonaDesfavorabilidad - null = sin zona, 1 a 5 = nivel
 * @param {object[]} tramosZona - tabla de % por nivel (ver DocTramoZona)
 * @param {number} cantidadModulos - solo relevante para tipo='hora_catedra' (cantidad de horas cátedra); 'cargo' siempre usa 1
 */
export function liquidarDesignacion({ cargo, valorPorIndice, aniosAntiguedad, tramosAntiguedad, conceptos, zonaDesfavorabilidad = null, tramosZona = [], cantidadModulos = 1 }) {
  const basico =
    cargo.tipo === "hora_catedra"
      ? calcularBasicoHoraCatedra({ valorPorIndice, divisorHoraCatedra: cargo.divisorHoraCatedra, cantidadModulos })
      : calcularBasico({ indice: cargo.indice, valorPorIndice, unidades: cargo.unidades });
  const antiguedad = calcularAntiguedad({ basico, aniosAntiguedad, tramos: tramosAntiguedad });

  const detalle = [
    { codigo: "110", nombre: "BASICO", importe: basico, tipo: "haber", aportaAportes: true },
    { codigo: "220", nombre: "ANTIGUEDAD", importe: antiguedad, tipo: "haber", aportaAportes: true },
  ];

  // 624 (RURAL) es un caso especial — su % depende del NIVEL de zona
  // desfavorable (1 a 5), no de un valor fijo guardado en DocConcepto.
  const porcentajeZona = buscarPorcentajeZona(zonaDesfavorabilidad, tramosZona);
  if (porcentajeZona > 0) {
    const importeZona = new Decimal(basico).times(porcentajeZona).dividedBy(100).toDecimalPlaces(2).toNumber();
    detalle.push({ codigo: "624", nombre: "RURAL", importe: importeZona, tipo: "haber", aportaAportes: true });
  }

  for (const concepto of conceptos) {
    if (concepto.codigo === "624") continue; // ya resuelto arriba con la tabla de tramos
    if (!conceptoAplica({ concepto, nivel: cargo.nivel, cargoNombre: cargo.nombre })) continue;
    const importe = calcularImporteConcepto({ concepto, basico, cargoNombre: cargo.nombre, cargoTipo: cargo.tipo, unidadesCargo: cargo.unidades, cantidadModulos, divisorHoraCatedra: cargo.divisorHoraCatedra });
    if (importe === 0) continue;
    detalle.push({ codigo: concepto.codigo, nombre: concepto.nombre, importe, tipo: "haber", aportaAportes: concepto.aportaAportes });
  }

  const totalHaberes = detalle.reduce((acc, d) => new Decimal(acc).plus(d.importe).toDecimalPlaces(2).toNumber(), 0);
  const baseAportable = detalle
    .filter((d) => d.aportaAportes)
    .reduce((acc, d) => new Decimal(acc).plus(d.importe).toDecimalPlaces(2).toNumber(), 0);
  const { ips, ioma } = calcularAportes(baseAportable);
  const totalDescuentos = new Decimal(ips).plus(ioma).toDecimalPlaces(2).toNumber();
  const neto = new Decimal(totalHaberes).minus(totalDescuentos).toDecimalPlaces(2).toNumber();

  return {
    basico,
    antiguedad,
    detalle: [
      ...detalle,
      { codigo: "1060", nombre: "I.P.S", importe: new Decimal(ips).negated().toNumber(), tipo: "descuento" },
      { codigo: "1280", nombre: "I.O.M.A.", importe: new Decimal(ioma).negated().toNumber(), tipo: "descuento" },
    ],
    totalHaberes,
    baseAportable,
    ips,
    ioma,
    totalDescuentos,
    neto,
  };
}
