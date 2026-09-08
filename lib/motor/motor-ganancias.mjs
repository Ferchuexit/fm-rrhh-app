// FM RRHH — lib/motor/motor-ganancias.mjs
//
// Cálculo de la RETENCIÓN MENSUAL de Impuesto a las Ganancias 4ta
// categoría (R.G. 4003, art. 30 y 94 de la ley) — el mecanismo
// ACUMULATIVO ANUAL, no la liquidación anual/final (eso es un cálculo
// distinto, con su propia tabla "anualizada" — pendiente, no confundir).
//
// Esta función es PURA (no toca la base) a propósito, para poder
// probarla con casos a mano, sin Prisma de por medio. Quien la llama
// (app/api/liquidar/route.ts) es responsable de juntar los datos reales
// del legajo (acumulado del año, cargas de familia vigentes, SIRADIG,
// retenciones ya practicadas) y pasárselos ya armados.
//
// Igual que motor-reglas.mjs: toda la aritmética interna usa Decimal
// (decimal.js) — acá hay bastantes pasos encadenados (restas, sumas,
// multiplicación por alícuota) y con `number` nativo eso es exactamente
// el tipo de cadena donde el error de float se nota. Quien llama a esta
// función sigue pasando y recibiendo `number` normales.
//
// Mecanismo, paso a paso (R.G. 4003):
//   1. Ganancia sujeta a aportes = bruto acumulado del año - aportes
//      (jubilación + obra social + ley 19.032) acumulados del año.
//   2. Deducciones personales del mes = ganancia no imponible acumulada
//      + deducción especial acumulada + (cónyuge/hijos/hijos incapacitados
//      VIGENTES × su valor acumulado) — todo según la tabla DE ESE MES
//      (no del semestre, cada mes tiene su propia tabla acumulada).
//   3. Ganancia neta sujeta a impuesto = paso 1 - deducciones generales
//      (SIRADIG) - paso 2. Nunca negativa (piso en 0).
//   4. Se busca el tramo de la escala del mes donde cae el resultado del
//      paso 3, y se aplica: impuesto = montoFijo + (excedente) × alícuota.
//   5. Retención de ESTE mes = impuesto acumulado (paso 4) - lo que ya
//      se retuvo en meses anteriores de este mismo año. Nunca negativa
//      (si diera negativo, no se retiene nada este mes — no se "devuelve"
//      en el acto; ARCA permite compensar en meses siguientes, pero eso
//      ya sale solo porque el acumulado de retenciones previas sigue
//      corriendo mes a mes).
import Decimal from "decimal.js";

export function calcularRetencionGanancias({
  gananciaBrutaAcumulada,
  aportesAcumulados,
  deduccionesGeneralesAcumuladas = 0,
  cargas = { conyuge: false, hijos: 0, hijosIncapacitados: 0 },
  retencionesPracticadasAcumuladas = 0,
  tabla,
}) {
  if (!tabla || !Array.isArray(tabla.tramos) || tabla.tramos.length === 0) {
    throw new Error("Falta la tabla de Ganancias del mes correspondiente — cargala con cargar-tablas-ganancias-2026.ts o el año que corresponda.");
  }

  const gananciaSujetaAAportesD = new Decimal(gananciaBrutaAcumulada).minus(aportesAcumulados);

  const deduccionCargasD = new Decimal(cargas.conyuge ? tabla.deduccionConyugeAcum : 0)
    .plus(new Decimal(cargas.hijos ?? 0).times(tabla.deduccionHijoAcum))
    .plus(new Decimal(cargas.hijosIncapacitados ?? 0).times(tabla.deduccionHijoIncapAcum));

  const deduccionesPersonalesTotalD = new Decimal(tabla.ganNoImponibleAcum).plus(tabla.deduccionEspecialAcum).plus(deduccionCargasD);

  const gananciaNetaSujetaAImpuestoD = Decimal.max(
    0,
    gananciaSujetaAAportesD.minus(deduccionesGeneralesAcumuladas).minus(deduccionesPersonalesTotalD)
  );

  let impuestoDeterminadoAcumuladoD = new Decimal(0);
  let tramoAplicado = null;

  if (gananciaNetaSujetaAImpuestoD.greaterThan(0)) {
    const tramosOrdenados = [...tabla.tramos].sort((a, b) => a.desde - b.desde);
    tramoAplicado =
      tramosOrdenados.find(
        (t) =>
          gananciaNetaSujetaAImpuestoD.greaterThan(t.desde) &&
          (t.hasta === null || t.hasta === undefined || gananciaNetaSujetaAImpuestoD.lessThanOrEqualTo(t.hasta))
      ) ?? tramosOrdenados[tramosOrdenados.length - 1];

    impuestoDeterminadoAcumuladoD = new Decimal(tramoAplicado.montoFijo).plus(
      gananciaNetaSujetaAImpuestoD.minus(tramoAplicado.sobreExcedenteDe).times(tramoAplicado.alicuota)
    );
  }

  const retencionEsteMesD = Decimal.max(0, impuestoDeterminadoAcumuladoD.minus(retencionesPracticadasAcumuladas));

  // Redondeo a centavos ACÁ, no dejarlo para quien llama — sin esto, el
  // resto del motor (que sí redondea cada concepto con Math.round(x*100)/100
  // dentro de liquidarLegajo) queda desalineado con lo único que no pasa
  // por ahí: Ganancias y Embargos, que arman su propio LiquidacionDetalle
  // directo. Es el bug real que encontró Fernando al revisar Camioneros.
  const dosDecimales = (d) => d.toDecimalPlaces(2);

  return {
    gananciaSujetaAAportes: dosDecimales(gananciaSujetaAAportesD).toNumber(),
    deduccionCargas: dosDecimales(deduccionCargasD).toNumber(),
    deduccionesPersonalesTotal: dosDecimales(deduccionesPersonalesTotalD).toNumber(),
    gananciaNetaSujetaAImpuesto: dosDecimales(gananciaNetaSujetaAImpuestoD).toNumber(),
    impuestoDeterminadoAcumulado: dosDecimales(impuestoDeterminadoAcumuladoD).toNumber(),
    retencionEsteMes: dosDecimales(retencionEsteMesD).toNumber(),
    tramoAplicado,
  };
}

// ── Deducciones generales (SIRADIG) con sus topes reales ──
//
// Cada categoría tiene su propio tope legal — no es "lo que declaró el
// empleado, tal cual". Fuentes cruzadas (Cronista, MiObraSocial,
// iProfesional, AFIP art. "Deducciones generales", todas coinciden):
//   - Alquiler de vivienda: 40% de lo abonado, tope = Ganancia No
//     Imponible ACUMULADA de ese mes (la misma que ya tenemos en la tabla).
//   - Servicio doméstico: el monto declarado completo, mismo tope que
//     alquiler (Ganancia No Imponible acumulada) — no es 40%, es el 100%
//     de lo pagado hasta ese tope.
//   - Cuota médico-asistencial (prepaga/obra social voluntaria) y gastos
//     médicos NO reintegrados: comparten un tope CONJUNTO del 5% de la
//     ganancia neta del ejercicio acumulada (bruto - aportes).
//   - Donaciones: su propio 5% de la ganancia neta, aparte del anterior
//     (no comparten el mismo tope).
//
// ⚠️ Seguro de vida/retiro e intereses de créditos hipotecarios tienen
// topes fijos en pesos que se actualizan de forma menos predecible y no
// los pude confirmar contra una fuente oficial de AFIP/ARCA directa (solo
// agregadores) — se aplican con el valor que encontré, marcado como
// "sin confirmar oficialmente", no inventar un valor si hace falta uno
// más preciso.
const TOPE_SEGURO_VIDA_ANUAL_2026 = 753472.14; // sin confirmar oficialmente — ver comentario arriba
const TOPE_INTERESES_HIPOTECARIOS_ANUAL_2026 = 753472.14; // ídem

export function calcularDeduccionesGeneralesConTopes({
  siradigPorTipo = {},
  ganNoImponibleAcum,
  gananciaSujetaAAportes,
  mesActual,
}) {
  const tope5pctD = Decimal.max(0, gananciaSujetaAAportes).times(0.05);
  // Los topes fijos anuales se prorratean al mes actual, mismo criterio
  // que ya se usa para prorratear lo declarado (montoAnual × mes / 12).
  const topeSeguroVidaAcumD = new Decimal(TOPE_SEGURO_VIDA_ANUAL_2026).times(mesActual).dividedBy(12);
  const topeInteresesHipotecariosAcumD = new Decimal(TOPE_INTERESES_HIPOTECARIOS_ANUAL_2026).times(mesActual).dividedBy(12);

  const alquilerD = Decimal.min(new Decimal(siradigPorTipo.alquiler_vivienda ?? 0).times(0.4), ganNoImponibleAcum);
  const servicioDomesticoD = Decimal.min(siradigPorTipo.servicio_domestico ?? 0, ganNoImponibleAcum);
  const medicoD = Decimal.min(new Decimal(siradigPorTipo.cuota_medico_asistencial ?? 0).plus(siradigPorTipo.gastos_medicos ?? 0), tope5pctD);
  const donacionesD = Decimal.min(siradigPorTipo.donaciones ?? 0, tope5pctD);
  const seguroVidaD = Decimal.min(siradigPorTipo.seguro_vida ?? 0, topeSeguroVidaAcumD);
  const interesesHipotecariosD = Decimal.min(siradigPorTipo.intereses_hipotecarios ?? 0, topeInteresesHipotecariosAcumD);
  // "otro" no tiene un tope legal conocido/genérico — se declara tal cual,
  // sin recortar, porque no hay una regla única que aplicarle. Quien cargue
  // algo acá tiene que saber que no se está validando contra ningún tope.
  const otroD = new Decimal(siradigPorTipo.otro ?? 0);

  const totalD = alquilerD.plus(servicioDomesticoD).plus(medicoD).plus(donacionesD).plus(seguroVidaD).plus(interesesHipotecariosD).plus(otroD);

  return {
    total: totalD.toDecimalPlaces(2).toNumber(),
    detalle: {
      alquiler: alquilerD.toDecimalPlaces(2).toNumber(),
      servicioDomestico: servicioDomesticoD.toDecimalPlaces(2).toNumber(),
      medico: medicoD.toDecimalPlaces(2).toNumber(),
      donaciones: donacionesD.toDecimalPlaces(2).toNumber(),
      seguroVida: seguroVidaD.toDecimalPlaces(2).toNumber(),
      interesesHipotecarios: interesesHipotecariosD.toDecimalPlaces(2).toNumber(),
      otro: otroD.toDecimalPlaces(2).toNumber(),
    },
  };
}
