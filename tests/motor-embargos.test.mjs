// tests/motor-embargos.test.mjs
import { describe, it, expect } from "vitest";
import { calcularTopeEmbargoComercial, calcularEmbargoJudicial } from "../lib/motor/motor-embargos.mjs";

const SMVM_AGOSTO_2026 = 376600;

describe("calcularTopeEmbargoComercial — Decreto 484/87", () => {
  it("un sueldo por debajo del SMVM es inembargable", () => {
    expect(calcularTopeEmbargoComercial(300000, SMVM_AGOSTO_2026)).toBe(0);
  });

  it("entre 1 y 2 SMVM: 10% del excedente sobre 1 SMVM", () => {
    const r = calcularTopeEmbargoComercial(600000, SMVM_AGOSTO_2026);
    expect(r).toBeCloseTo((600000 - SMVM_AGOSTO_2026) * 0.1, 2);
  });

  it("por encima de 2 SMVM: 10% de la primera franja + 20% del resto", () => {
    const r = calcularTopeEmbargoComercial(1500000, SMVM_AGOSTO_2026);
    const esperado = SMVM_AGOSTO_2026 * 0.1 + (1500000 - SMVM_AGOSTO_2026 * 2) * 0.2;
    expect(r).toBeCloseTo(esperado, 2);
  });
});

describe("calcularEmbargoJudicial — sin tope (Decreto 484/87 art. 4, excluye alimentos)", () => {
  it("aplica el % dictado por el juez directo, sin ningún límite", () => {
    expect(calcularEmbargoJudicial(1000000, 30)).toBe(300000);
  });

  it("nunca da negativo", () => {
    expect(calcularEmbargoJudicial(-500000, 30)).toBe(0);
  });
});
