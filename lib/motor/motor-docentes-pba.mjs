// FM RRHH — lib/motor/motor-docentes-pba.mjs
//
// Motor puro (sin Prisma) para Docentes PBA — Fase 1: Maestro de Grado y
// Preceptor, Primaria, modalidad "Jornada Completa - 8 hs" únicamente.
// Todo confirmado al centavo contra la calculadora oficial de FEB
// (calculadora.feb.org.ar), período agosto 2026 — ver chat 12-13/09/2026
// para el detalle de cada caso usado.
//
// ALCANCE DE FASE 1 (a propósito, no es un olvido):
//   - Solo "Jornada Completa - 8 hs". Jornada Extendida y otras
//     modalidades especiales quedan pendientes — BASICO y ANTIGUEDAD sí
//     calculan bien para cualquier modalidad (escalan con el índice de
//     forma proporcional, confirmado), pero los montos fijos
//     (438/455/641/2575) NO se confirmaron para otra cosa que no sea
//     Jornada Completa — no inventamos un valor para Extendida.
//   - GARANTÍA (pisos mínimos históricos, "MAR/2007"/"730") no está
//     implementada — mueve centavos, no vale la pena todavía.
//   - Zona rural: solo sí/no (30%) — los 5 niveles de "Desfavorabilidad"
//     de FEB no están contemplados.
import Decimal from "decimal.js";

const TASA_IPS = 0.16;
const TASA_IOMA = 0.048;

// 641 es el único concepto confirmado que varía por CARGO en vez de por
// unidades — Preceptor cobra el valor base (el que vive en
// DocValorConcepto), Maestro de Grado cobra exactamente el doble.
// Confirmado con 4 casos reales (2 cargos × 2 modalidades). No es una
// fórmula general — es este caso puntual, documentado acá a propósito.
const MULTIPLICADORES_641_POR_CARGO = {
  "Maestro de Grado": 2,
  Preceptor: 1,
};

/**
 * BASICO = índice del cargo × valor del punto de índice × unidades de la
 * designación (Jornada Completa = 2, Jornada Extendida = 1,75...).
 * Confirmado exacto para Maestro de Grado y Preceptor, ambas modalidades.
 */
export function calcularBasico({ indice, valorPorIndice, unidades }) {
  return new Decimal(indice).times(valorPorIndice).times(unidades).toDecimalPlaces(2).toNumber();
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
export function calcularImporteConcepto({ concepto, basico, cargoNombre }) {
  if (concepto.modoCalculo === "porcentaje_basico") {
    return new Decimal(basico).times(concepto.valor).dividedBy(100).toDecimalPlaces(2).toNumber();
  }
  if (concepto.modoCalculo === "fijo_por_unidad") {
    const multiplicador = concepto.codigo === "641" ? MULTIPLICADORES_641_POR_CARGO[cargoNombre] ?? 1 : 1;
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
 * Liquida UNA designación completa — junta BASICO, ANTIGUEDAD y los
 * conceptos aplicables, y calcula IPS/IOMA sobre la base correcta.
 * Función pura: no consulta la base, todo lo que necesita se lo pasan
 * ya resuelto (cargo, conceptos, tramos).
 *
 * @param {object} cargo - { nombre, nivel, modalidad, indice, unidades, tipo }
 * @param {number} valorPorIndice
 * @param {number} aniosAntiguedad
 * @param {object[]} tramosAntiguedad
 * @param {object[]} conceptos - catálogo completo con su valor vigente ya resuelto
 * @param {boolean} zonaRural
 */
export function liquidarDesignacion({ cargo, valorPorIndice, aniosAntiguedad, tramosAntiguedad, conceptos, zonaRural = false }) {
  if (cargo.modalidad !== "Jornada Completa - 8 hs") {
    console.warn(
      `⚠ Designación de "${cargo.nombre}" con modalidad "${cargo.modalidad}" — Fase 1 solo confirmó los montos fijos (438/455/641/2575) para Jornada Completa. BASICO y ANTIGUEDAD sí son correctos; los montos fijos pueden no serlo.`
    );
  }

  const basico = calcularBasico({ indice: cargo.indice, valorPorIndice, unidades: cargo.unidades });
  const antiguedad = calcularAntiguedad({ basico, aniosAntiguedad, tramos: tramosAntiguedad });

  const detalle = [
    { codigo: "110", nombre: "BASICO", importe: basico, tipo: "haber", aportaAportes: true },
    { codigo: "220", nombre: "ANTIGUEDAD", importe: antiguedad, tipo: "haber", aportaAportes: true },
  ];

  for (const concepto of conceptos) {
    if (concepto.codigo === "624" && !zonaRural) continue; // RURAL solo si corresponde
    if (!conceptoAplica({ concepto, nivel: cargo.nivel, cargoNombre: cargo.nombre })) continue;
    const importe = calcularImporteConcepto({ concepto, basico, cargoNombre: cargo.nombre });
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
