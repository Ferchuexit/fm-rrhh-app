// tests/casos-combinados.test.mjs
//
// Los últimos puntos de la lista mínima del documento de mejora
// (conceptos no remunerativos, múltiples novedades combinadas,
// vacaciones/ausencias) no necesitaban ninguna funcionalidad nueva — ya
// funcionaban, solo faltaba cubrirlos con una prueba persistida.
import { describe, it, expect } from "vitest";
import { liquidarLegajo, evaluarFormula } from "../lib/motor/motor-reglas.mjs";

describe("Conceptos NO remunerativos — no cuentan para REM_TOTAL(), pero sí para el bruto", () => {
  it("un concepto no_remunerativo (ej. Ajuste SAC de Madera) no infla la base de aportes", () => {
    const conceptos = [
      { codigo: "REM_BASICA", tipo: "remunerativo" },
      { codigo: "AJUSTE_SAC", tipo: "no_remunerativo" },
      { codigo: "JUBILACION", tipo: "descuento" },
    ];
    const reglas = [
      { conceptoCodigo: "REM_BASICA", formula: "BASICO", aporta: true, contribuye: true },
      { conceptoCodigo: "AJUSTE_SAC", formula: "HORAS_TRABAJADAS * VALOR_HORA * 0.019", aporta: false, contribuye: false },
      { conceptoCodigo: "JUBILACION", formula: "REM_TOTAL() * 0.11", aporta: false, contribuye: false },
    ];
    const resultado = liquidarLegajo({
      varsBase: { BASICO: 500000, VALOR_HORA: 3000, HORAS_TRABAJADAS: 190 },
      conceptos, reglas,
    });

    const jubilacion = resultado.detalle.find((d) => d.conceptoCodigo === "JUBILACION");
    expect(jubilacion.importe).toBeCloseTo(500000 * 0.11, 2); // SOLO sobre lo remunerativo

    const ajusteSac = 190 * 3000 * 0.019;
    expect(resultado.bruto).toBeCloseTo(500000 + ajusteSac, 2); // el bruto SÍ suma ambos
  });
});

describe("Múltiples novedades combinadas en la misma liquidación", () => {
  it("horas extra 50%, 100%, y vacaciones juntas se calculan independientes, sin interferirse", () => {
    const conceptos = [
      { codigo: "REM_BASICA", tipo: "remunerativo" },
      { codigo: "HS_EXTRA_50", tipo: "remunerativo" },
      { codigo: "HS_EXTRA_100", tipo: "remunerativo" },
      { codigo: "ADICIONAL_VACACIONES", tipo: "remunerativo" },
    ];
    const reglas = [
      { conceptoCodigo: "REM_BASICA", formula: "BASICO", aporta: true, contribuye: true },
      { conceptoCodigo: "HS_EXTRA_50", formula: "VALOR_CATEGORIA('HS_EXTRA_50') * CANTIDAD()", aporta: true, contribuye: true },
      { conceptoCodigo: "HS_EXTRA_100", formula: "VALOR_CATEGORIA('HS_EXTRA_100') * CANTIDAD()", aporta: true, contribuye: true },
      { conceptoCodigo: "ADICIONAL_VACACIONES", formula: "CANTIDAD() * TOPE('ADICIONAL_VACACIONES_CAMIONEROS')", aporta: true, contribuye: true },
    ];
    const resultado = liquidarLegajo({
      varsBase: { BASICO: 1075910.44 },
      conceptos, reglas,
      valoresCategoria: { HS_EXTRA_50: 8405.55, HS_EXTRA_100: 11207.4 },
      cantidades: { HS_EXTRA_50: 8, HS_EXTRA_100: 4, ADICIONAL_VACACIONES: 14 },
      topes: { ADICIONAL_VACACIONES_CAMIONEROS: 25132.45 },
    });

    expect(resultado.detalle.find((d) => d.conceptoCodigo === "HS_EXTRA_50").importe).toBeCloseTo(8405.55 * 8, 2);
    expect(resultado.detalle.find((d) => d.conceptoCodigo === "HS_EXTRA_100").importe).toBeCloseTo(11207.4 * 4, 2);
    expect(resultado.detalle.find((d) => d.conceptoCodigo === "ADICIONAL_VACACIONES").importe).toBeCloseTo(25132.45 * 14, 2);

    const esperadoBruto = 1075910.44 + 8405.55 * 8 + 11207.4 * 4 + 25132.45 * 14;
    expect(resultado.bruto).toBeCloseTo(esperadoBruto, 2);
  });
});

describe("Madera — Vacaciones (horas de vacaciones gozadas × valor hora)", () => {
  it("VACACIONES_HORAS: cantidad de horas × valor hora, igual que Enfermedades/Feriados", () => {
    const r = evaluarFormula("CANTIDAD() * VALOR_HORA", {
      vars: { VALOR_HORA: 5000 },
      conceptoActual: "VACACIONES_HORAS",
      cantidades: { VACACIONES_HORAS: 48 },
    });
    expect(r).toBe(240000);
  });
});

describe("Madera — Ausencias (HS_AUSENCIAS resta del total de horas)", () => {
  it("ausencias sin ningún otro concepto: TOTAL_HORAS las resta directo", () => {
    const TOTAL_HORAS = "(HORAS_TRABAJADAS + CANTIDAD('ENFERMEDADES') + CANTIDAD('FERIADOS') + CANTIDAD('HS_ACCIDENTE') + CANTIDAD('VACACIONES_HORAS') - CANTIDAD('HS_AUSENCIAS'))";
    const r = evaluarFormula(`${TOTAL_HORAS} * VALOR_HORA`, {
      vars: { HORAS_TRABAJADAS: 190, VALOR_HORA: 5000 },
      conceptoActual: "SNR",
      cantidades: { ENFERMEDADES: 0, FERIADOS: 0, HS_ACCIDENTE: 0, VACACIONES_HORAS: 0, HS_AUSENCIAS: 16 },
    });
    expect(r).toBeCloseTo((190 - 16) * 5000, 2);
  });
});
