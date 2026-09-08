// tests/motor-ganancias.test.mjs
import { describe, it, expect } from "vitest";
import { calcularRetencionGanancias, calcularDeduccionesGeneralesConTopes } from "../lib/motor/motor-ganancias.mjs";

const TABLA_AGOSTO_2026 = {
  ganNoImponibleAcum: 3579179.81,
  deduccionEspecialAcum: 12527129.34,
  deduccionConyugeAcum: 3370869.51,
  deduccionHijoAcum: 1699941.79,
  deduccionHijoIncapAcum: 3399883.58,
  tramos: [
    { desde: 0, hasta: 1389507.33, montoFijo: 0, alicuota: 0.05, sobreExcedenteDe: 0 },
    { desde: 1389507.33, hasta: 2779014.64, montoFijo: 69475.37, alicuota: 0.09, sobreExcedenteDe: 1389507.33 },
    { desde: 2779014.64, hasta: 4168521.97, montoFijo: 194531.02, alicuota: 0.12, sobreExcedenteDe: 2779014.64 },
    { desde: 4168521.97, hasta: 6252782.96, montoFijo: 361271.9, alicuota: 0.15, sobreExcedenteDe: 4168521.97 },
    { desde: 6252782.96, hasta: 12505565.93, montoFijo: 673911.05, alicuota: 0.19, sobreExcedenteDe: 6252782.96 },
    { desde: 12505565.93, hasta: 18758348.89, montoFijo: 1861939.82, alicuota: 0.23, sobreExcedenteDe: 12505565.93 },
    { desde: 18758348.89, hasta: null, montoFijo: 3300079.9, alicuota: 0.27, sobreExcedenteDe: 18758348.89 },
  ],
};

// Tabla de julio real (deducciones reales, tramos SIMPLIFICADOS a un solo
// tramo amplio — alcanza para probar el MECANISMO de acumulado sin
// necesitar los 9 tramos reales completos).
const TABLA_JULIO_SIMPLIFICADA = {
  ganNoImponibleAcum: 3077540.53, deduccionEspecialAcum: 10771391.86,
  deduccionConyugeAcum: 0, deduccionHijoAcum: 0, deduccionHijoIncapAcum: 0,
  tramos: [
    { desde: 0, hasta: 5376425.33, montoFijo: 0, alicuota: 0.05, sobreExcedenteDe: 0 },
    { desde: 5376425.33, hasta: 10752850.66, montoFijo: 269541.14, alicuota: 0.19, sobreExcedenteDe: 5376425.33 },
    { desde: 10752850.66, hasta: null, montoFijo: 1291612.94, alicuota: 0.23, sobreExcedenteDe: 10752850.66 },
  ],
};
// Ídem para junio, un solo tramo, solo para la prueba de acumulado.
const TABLA_JUNIO_SIMPLIFICADA = {
  ganNoImponibleAcum: 2575901.25, deduccionEspecialAcum: 9015654.38,
  deduccionConyugeAcum: 0, deduccionHijoAcum: 0, deduccionHijoIncapAcum: 0,
  tramos: [{ desde: 0, hasta: null, montoFijo: 0, alicuota: 0.05, sobreExcedenteDe: 0 }],
};

describe("calcularRetencionGanancias — caso base", () => {
  it("un sueldo alto sin cargas de familia da el impuesto esperado (caso validado a mano)", () => {
    const r = calcularRetencionGanancias({
      gananciaBrutaAcumulada: 30000000,
      aportesAcumulados: 5100000,
      retencionesPracticadasAcumuladas: 950000,
      tabla: TABLA_AGOSTO_2026,
    });
    expect(r.gananciaSujetaAAportes).toBeCloseTo(24900000, 2);
    expect(r.gananciaNetaSujetaAImpuesto).toBeCloseTo(8793690.85, 2);
    expect(r.impuestoDeterminadoAcumulado).toBeCloseTo(1156683.55, 2);
    expect(r.retencionEsteMes).toBeCloseTo(206683.55, 2);
  });

  it("por debajo del piso de deducciones, la retención da 0 (nunca negativa)", () => {
    const r = calcularRetencionGanancias({ gananciaBrutaAcumulada: 10000000, aportesAcumulados: 1700000, tabla: TABLA_AGOSTO_2026 });
    expect(r.retencionEsteMes).toBe(0);
    expect(r.gananciaNetaSujetaAImpuesto).toBe(0);
  });

  it("si ya se retuvo de más en meses anteriores, este mes no cobra negativo", () => {
    const r = calcularRetencionGanancias({
      gananciaBrutaAcumulada: 30000000,
      aportesAcumulados: 5100000,
      retencionesPracticadasAcumuladas: 99999999,
      tabla: TABLA_AGOSTO_2026,
    });
    expect(r.retencionEsteMes).toBe(0);
  });

  it("cónyuge + 2 hijos reduce la ganancia neta sujeta a impuesto respecto de no tener cargas", () => {
    const sinCargas = calcularRetencionGanancias({ gananciaBrutaAcumulada: 30000000, aportesAcumulados: 5100000, tabla: TABLA_AGOSTO_2026 });
    const conCargas = calcularRetencionGanancias({
      gananciaBrutaAcumulada: 30000000,
      aportesAcumulados: 5100000,
      cargas: { conyuge: true, hijos: 2, hijosIncapacitados: 0 },
      tabla: TABLA_AGOSTO_2026,
    });
    expect(conCargas.gananciaNetaSujetaAImpuesto).toBeLessThan(sinCargas.gananciaNetaSujetaAImpuesto);
    const deduccionCargasEsperada = 3370869.51 + 2 * 1699941.79;
    expect(conCargas.deduccionCargas).toBeCloseTo(deduccionCargasEsperada, 2);
  });
});

describe("calcularRetencionGanancias — acumulado mes a mes (la prueba que más importa)", () => {
  it("la suma de lo retenido en 3 meses seguidos coincide EXACTO con el impuesto total acumulado al tercer mes", () => {
    const brutoMensual = 13000000;
    const aportesMensual = brutoMensual * 0.17;
    const tablas = { junio: TABLA_JUNIO_SIMPLIFICADA, julio: TABLA_JULIO_SIMPLIFICADA, agosto: TABLA_AGOSTO_2026 };

    let brutoAcum = 0, aportesAcum = 0, retencionAcum = 0;
    const retencionesPorMes = [];
    for (const mes of ["junio", "julio", "agosto"]) {
      brutoAcum += brutoMensual;
      aportesAcum += aportesMensual;
      const r = calcularRetencionGanancias({
        gananciaBrutaAcumulada: brutoAcum,
        aportesAcumulados: aportesAcum,
        retencionesPracticadasAcumuladas: retencionAcum,
        tabla: tablas[mes],
      });
      retencionesPorMes.push(r.retencionEsteMes);
      retencionAcum += r.retencionEsteMes;
    }

    const impuestoFinalAcumulado = calcularRetencionGanancias({
      gananciaBrutaAcumulada: brutoAcum,
      aportesAcumulados: aportesAcum,
      tabla: tablas.agosto,
    }).impuestoDeterminadoAcumulado;

    const sumaDeLoRetenido = retencionesPorMes.reduce((a, b) => a + b, 0);
    expect(sumaDeLoRetenido).toBeCloseTo(impuestoFinalAcumulado, 1);
  });
});

describe("calcularRetencionGanancias — saldo inicial (legajo que entra a mitad de año)", () => {
  it("entrar en agosto con saldo inicial da el MISMO resultado que haber estado todo el año en el sistema", () => {
    const brutoMensual = 8000000;
    const aportesMensual = brutoMensual * 0.17;
    const brutoAcumJulio = brutoMensual * 7;
    const aportesAcumJulio = aportesMensual * 7;

    const retencionAcumJulio = calcularRetencionGanancias({
      gananciaBrutaAcumulada: brutoAcumJulio, aportesAcumulados: aportesAcumJulio, tabla: TABLA_JULIO_SIMPLIFICADA,
    }).impuestoDeterminadoAcumulado;

    // Escenario A: todo el año vivió en el sistema
    const escenarioA = calcularRetencionGanancias({
      gananciaBrutaAcumulada: brutoAcumJulio + brutoMensual,
      aportesAcumulados: aportesAcumJulio + aportesMensual,
      retencionesPracticadasAcumuladas: retencionAcumJulio,
      tabla: TABLA_AGOSTO_2026,
    });

    // Escenario B: recién entra en agosto, con saldo inicial que representa lo mismo
    const escenarioB = calcularRetencionGanancias({
      gananciaBrutaAcumulada: 0 + brutoMensual + brutoAcumJulio, // "en sistema"=0 + este mes + saldo inicial
      aportesAcumulados: 0 + aportesMensual + aportesAcumJulio,
      retencionesPracticadasAcumuladas: 0 + retencionAcumJulio,
      tabla: TABLA_AGOSTO_2026,
    });

    expect(escenarioB.retencionEsteMes).toBeCloseTo(escenarioA.retencionEsteMes, 2);
  });
});

describe("calcularDeduccionesGeneralesConTopes — SIRADIG con topes reales", () => {
  it("un alquiler declarado exageradamente alto se topea a la Ganancia No Imponible, no al 40% completo", () => {
    const { detalle } = calcularDeduccionesGeneralesConTopes({
      siradigPorTipo: { alquiler_vivienda: 50000000 }, // 40% = 20.000.000, mucho más que la GNI
      ganNoImponibleAcum: 3579179.81,
      gananciaSujetaAAportes: 20000000,
      mesActual: 8,
    });
    expect(detalle.alquiler).toBeCloseTo(3579179.81, 2);
  });

  it("medicina prepaga + gastos médicos comparten un tope conjunto del 5% de la ganancia neta", () => {
    const { detalle } = calcularDeduccionesGeneralesConTopes({
      siradigPorTipo: { cuota_medico_asistencial: 1000000, gastos_medicos: 1000000 }, // declarado: 2M, tope 5% de 20M = 1M
      ganNoImponibleAcum: 3579179.81,
      gananciaSujetaAAportes: 20000000,
      mesActual: 8,
    });
    expect(detalle.medico).toBeCloseTo(1000000, 2);
  });

  it("donaciones tiene SU PROPIO 5%, no comparte tope con el médico", () => {
    const { detalle } = calcularDeduccionesGeneralesConTopes({
      siradigPorTipo: { cuota_medico_asistencial: 1000000, donaciones: 1000000 },
      ganNoImponibleAcum: 3579179.81,
      gananciaSujetaAAportes: 20000000,
      mesActual: 8,
    });
    expect(detalle.medico).toBeCloseTo(1000000, 2);
    expect(detalle.donaciones).toBeCloseTo(1000000, 2); // cada uno con su 5%, no 1M repartido entre los dos
  });
});
