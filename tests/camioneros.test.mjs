// tests/camioneros.test.mjs
//
// Cada caso acá replica un cálculo que ya validamos a mano contra el
// motor real durante la construcción del convenio Camioneros — ver la
// conversación de agosto 2026. Los números "esperado" NO están inventados
// para el test: son los mismos que confirmamos entonces.
import { describe, it, expect } from "vitest";
import { evaluarFormula } from "../lib/motor/motor-reglas.mjs";

const TOPES_AGOSTO_2026 = { TOPE_JUBILATORIO: 4594798.23, TOPE_JUBILATORIO_MINIMO: 141380.42 };
const FORMULA_TOPEO = "IF(DIAS_TRABAJADOS >= DIAS_MES, MAX(MIN(REM_TOTAL(), TOPE('TOPE_JUBILATORIO')), TOPE('TOPE_JUBILATORIO_MINIMO')), MIN(REM_TOTAL(), TOPE('TOPE_JUBILATORIO')))";

describe("Camioneros — Antigüedad (1% por año, sobre el básico)", () => {
  it("da 0 para un legajo recién ingresado", () => {
    const r = evaluarFormula("CONCEPTO('REM_BASICA') * ANTIGUEDAD_ANIOS * 0.01", {
      conceptos: { REM_BASICA: 1075910.44 },
      vars: { ANTIGUEDAD_ANIOS: 0 },
    });
    expect(r).toBe(0);
  });

  it("da básico × 0,20 para 20 años de antigüedad", () => {
    const r = evaluarFormula("CONCEPTO('REM_BASICA') * ANTIGUEDAD_ANIOS * 0.01", {
      conceptos: { REM_BASICA: 1075910.44 },
      vars: { ANTIGUEDAD_ANIOS: 20 },
    });
    expect(r).toBeCloseTo(1075910.44 * 0.2, 2);
  });
});

describe("Camioneros — Jubilación/Ley19032/ObraSocial con tope real (agosto 2026)", () => {
  it("Conductor de Primera con antigüedad, mes completo: aportes topeados correctamente", () => {
    const remTotal = 1075910.44 + 53795.52; // básico + antigüedad (5 años)
    const ctx = { remTotal, topes: TOPES_AGOSTO_2026, vars: { DIAS_TRABAJADOS: 30, DIAS_MES: 30 } };
    const jubilacion = evaluarFormula(FORMULA_TOPEO + " * 0.11", ctx);
    expect(jubilacion).toBeCloseTo((1075910.44 + 53795.52) * 0.11, 2); // no llega al tope, así que da igual que remTotal * 0.11
  });

  it("un sueldo MUY por encima del tope se limita al tope, no sigue creciendo", () => {
    const ctx = { remTotal: 26500000, topes: TOPES_AGOSTO_2026, vars: { DIAS_TRABAJADOS: 31, DIAS_MES: 31 } };
    const jubilacion = evaluarFormula(FORMULA_TOPEO + " * 0.11", ctx);
    expect(jubilacion).toBeCloseTo(4594798.23 * 0.11, 2); // topeado, NO 26.500.000*0.11
  });

  it("contribución patronal NO tiene techo (Decreto 814/2001) — a propósito distinta de los aportes del empleado", () => {
    const contribucion = evaluarFormula("REM_TOTAL() * 0.18", { remTotal: 26500000 });
    expect(contribucion).toBeCloseTo(26500000 * 0.18, 2); // sin tope, crece con el sueldo
  });
});

describe("Camioneros — Sindicato (3% afiliados / 2,5% no afiliados)", () => {
  const formula = "IF(AFILIADO_SINDICATO == 1, REM_TOTAL() * 0.03, REM_TOTAL() * 0.025)";

  it("cobra 3% si está afiliado", () => {
    expect(evaluarFormula(formula, { remTotal: 1000000, vars: { AFILIADO_SINDICATO: 1 } })).toBe(30000);
  });

  it("cobra 2,5% si NO está afiliado", () => {
    expect(evaluarFormula(formula, { remTotal: 1000000, vars: { AFILIADO_SINDICATO: 0 } })).toBe(25000);
  });
});

describe("Camioneros — Horas extra (valor FIJO por categoría, no un % del valor hora)", () => {
  it("HS_EXTRA_50 de un Conductor de Primera: 8 horas × $8.405,55", () => {
    const r = evaluarFormula("VALOR_CATEGORIA('HS_EXTRA_50') * CANTIDAD()", {
      valoresCategoria: { HS_EXTRA_50: 8405.55 },
      conceptoActual: "HS_EXTRA_50",
      cantidades: { HS_EXTRA_50: 8 },
    });
    expect(r).toBeCloseTo(8405.55 * 8, 2);
  });
});

describe("Camioneros — Adicional de vacaciones (monto fijo por día, no por categoría)", () => {
  it("14 días gozados × $25.132,45", () => {
    const r = evaluarFormula("CANTIDAD() * TOPE('ADICIONAL_VACACIONES_CAMIONEROS')", {
      conceptoActual: "ADICIONAL_VACACIONES",
      cantidades: { ADICIONAL_VACACIONES: 14 },
      topes: { ADICIONAL_VACACIONES_CAMIONEROS: 25132.45 },
    });
    expect(r).toBeCloseTo(25132.45 * 14, 2);
  });
});

describe("Camioneros — Día del Trabajador Camionero (jornal × 2 o × 3 según calendario)", () => {
  it("día de semana: jornal × 2 (100% de recargo)", () => {
    const r = evaluarFormula("VALOR_CATEGORIA('DIA_CAMIONERO') * CANTIDAD()", {
      valoresCategoria: { DIA_CAMIONERO: 44829.6 },
      conceptoActual: "DIA_CAMIONERO",
      cantidades: { DIA_CAMIONERO: 2 },
    });
    expect(r).toBeCloseTo(44829.6 * 2, 2);
  });

  it("cae fin de semana: jornal × 3 (200% de recargo)", () => {
    const r = evaluarFormula("VALOR_CATEGORIA('DIA_CAMIONERO') * CANTIDAD()", {
      valoresCategoria: { DIA_CAMIONERO: 44829.6 },
      conceptoActual: "DIA_CAMIONERO",
      cantidades: { DIA_CAMIONERO: 3 },
    });
    expect(r).toBeCloseTo(44829.6 * 3, 2);
  });
});

describe("Comercio — Horas extra mensuales (básico / (días × 8) × recargo)", () => {
  it("HS_EXTRA_50: 10 horas, básico $800.000, mes de 30 días", () => {
    const r = evaluarFormula("(BASICO / (DIAS_MES * 8)) * 1.5 * CANTIDAD()", {
      vars: { BASICO: 800000, DIAS_MES: 30 },
      conceptoActual: "HS_EXTRA_50",
      cantidades: { HS_EXTRA_50: 10 },
    });
    const valorHora = 800000 / (30 * 8);
    expect(r).toBeCloseTo(valorHora * 1.5 * 10, 2);
  });

  it("HS_EXTRA_100: 5 horas, mismo básico y mes", () => {
    const r = evaluarFormula("(BASICO / (DIAS_MES * 8)) * 2 * CANTIDAD()", {
      vars: { BASICO: 800000, DIAS_MES: 30 },
      conceptoActual: "HS_EXTRA_100",
      cantidades: { HS_EXTRA_100: 5 },
    });
    const valorHora = 800000 / (30 * 8);
    expect(r).toBeCloseTo(valorHora * 2 * 5, 2);
  });
});
