// tests/madera.test.mjs
//
// Madera (CCT 0335/75) es el convenio ORIGINAL del sistema, jornal por
// hora — la mecánica es distinta a Comercio/Camioneros (básico mensual).
// Fórmulas reales tomadas de prisma/crear-enfermedades-feriados-art-vacaciones-madera.ts.
import { describe, it, expect } from "vitest";
import { evaluarFormula } from "../lib/motor/motor-reglas.mjs";

const BASE_ANTIG = "(CONCEPTO('REM_BASICA') + CONCEPTO('ENFERMEDADES') + CONCEPTO('FERIADOS') + CONCEPTO('HS_ACCIDENTE'))";
const TOTAL_HORAS = "(HORAS_TRABAJADAS + CANTIDAD('ENFERMEDADES') + CANTIDAD('FERIADOS') + CANTIDAD('HS_ACCIDENTE') + CANTIDAD('VACACIONES_HORAS') - CANTIDAD('HS_AUSENCIAS'))";
const FORMULA_PRESENTISMO = "IF(CANTIDAD('HS_AUSENCIAS') + CANTIDAD('ENFERMEDADES') == 0, (CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD') + CONCEPTO('FERIADOS') + CONCEPTO('HS_ACCIDENTE')) * 0.10, 0)";

describe("Madera — Enfermedades / Feriados / ART (todos: cantidad de horas × valor hora)", () => {
  it("ENFERMEDADES: horas cargadas × valor hora", () => {
    const r = evaluarFormula("CANTIDAD() * VALOR_HORA", { vars: { VALOR_HORA: 5000 }, conceptoActual: "ENFERMEDADES", cantidades: { ENFERMEDADES: 8 } });
    expect(r).toBe(40000);
  });

  it("FERIADOS trabajados: mismo mecanismo", () => {
    const r = evaluarFormula("CANTIDAD() * VALOR_HORA", { vars: { VALOR_HORA: 5000 }, conceptoActual: "FERIADOS", cantidades: { FERIADOS: 8 } });
    expect(r).toBe(40000);
  });
});

describe("Madera — Antigüedad (base amplia: básico + enfermedades + feriados + ART, NO solo básico)", () => {
  it("suma las 4 partes antes de aplicar el %", () => {
    const r = evaluarFormula(`${BASE_ANTIG} * ANTIGUEDAD_ANIOS * 0.01`, {
      conceptos: { REM_BASICA: 500000, ENFERMEDADES: 40000, FERIADOS: 20000, HS_ACCIDENTE: 0 },
      vars: { ANTIGUEDAD_ANIOS: 5 },
    });
    expect(r).toBeCloseTo((500000 + 40000 + 20000) * 5 * 0.01, 2);
  });
});

describe("Madera — Presentismo (TODO O NADA — cualquier ausencia lo anula completo)", () => {
  it("sin ausencias ni enfermedad: cobra el 10% completo", () => {
    const r = evaluarFormula(FORMULA_PRESENTISMO, {
      conceptos: { REM_BASICA: 500000, ANTIGUEDAD: 25000, FERIADOS: 0, HS_ACCIDENTE: 0 },
      conceptoActual: "PRESENTISMO",
      cantidades: { HS_AUSENCIAS: 0, ENFERMEDADES: 0 },
    });
    expect(r).toBeCloseTo((500000 + 25000) * 0.1, 2);
  });

  it("con UNA sola hora de ausencia, el presentismo se anula ENTERO (no se prorratea)", () => {
    const r = evaluarFormula(FORMULA_PRESENTISMO, {
      conceptos: { REM_BASICA: 500000, ANTIGUEDAD: 25000, FERIADOS: 0, HS_ACCIDENTE: 0 },
      conceptoActual: "PRESENTISMO",
      cantidades: { HS_AUSENCIAS: 1, ENFERMEDADES: 0 },
    });
    expect(r).toBe(0);
  });

  it("con un día de enfermedad también se anula (no solo ausencias injustificadas)", () => {
    const r = evaluarFormula(FORMULA_PRESENTISMO, {
      conceptos: { REM_BASICA: 500000, ANTIGUEDAD: 25000, FERIADOS: 0, HS_ACCIDENTE: 0 },
      conceptoActual: "PRESENTISMO",
      cantidades: { HS_AUSENCIAS: 0, ENFERMEDADES: 8 },
    });
    expect(r).toBe(0);
  });
});

describe("Madera — SNR y Ajuste SAC (1,9% sobre el total de horas trabajadas, incluidas licencias)", () => {
  it("TOTAL_HORAS suma horas trabajadas + licencias/feriados/ART/vacaciones, y RESTA ausencias", () => {
    const contexto = {
      vars: { VALOR_HORA: 5000, HORAS_TRABAJADAS: 176 },
      conceptoActual: "SNR",
      cantidades: { ENFERMEDADES: 8, FERIADOS: 8, HS_ACCIDENTE: 0, VACACIONES_HORAS: 0, HS_AUSENCIAS: 4 },
    };
    const horasEsperadas = 176 + 8 + 8 + 0 + 0 - 4;
    const r = evaluarFormula(`${TOTAL_HORAS} * VALOR_HORA * 0.019`, contexto);
    expect(r).toBeCloseTo(horasEsperadas * 5000 * 0.019, 2);
  });
});
