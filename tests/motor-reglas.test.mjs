// tests/motor-reglas.test.mjs
//
// Pruebas del motor de fórmulas EN SÍ (no de un convenio en particular) —
// operadores, funciones (CONCEPTO, CANTIDAD, VALOR_CATEGORIA, TOPE,
// REM_TOTAL) y las restricciones de seguridad que evitan usarlas donde no
// corresponde. Los casos con convenios reales (Madera, Comercio,
// Camioneros) viven en sus propios archivos.
import { describe, it, expect } from "vitest";
import { evaluarFormula } from "../lib/motor/motor-reglas.mjs";

describe("Operadores de comparación", () => {
  it("soporta >=, ==, y aritmética básica", () => {
    expect(evaluarFormula("10 >= 10", {})).toBe(true);
    expect(evaluarFormula("5 == 5", {})).toBe(true);
    expect(evaluarFormula("2 + 2 * 3", {})).toBe(8);
  });

  it("IF elige la rama correcta según la condición", () => {
    expect(evaluarFormula("IF(1 == 1, 100, 200)", {})).toBe(100);
    expect(evaluarFormula("IF(1 == 2, 100, 200)", {})).toBe(200);
  });
});

describe("CONCEPTO() — referencia a otro concepto ya calculado", () => {
  it("lee el valor de otro concepto por código", () => {
    const resultado = evaluarFormula("CONCEPTO('REM_BASICA') * 2", { conceptos: { REM_BASICA: 500000 } });
    expect(resultado).toBe(1000000);
  });
});

describe("CANTIDAD() — cantidad cargada por Novedad", () => {
  it("usa la cantidad del concepto actual cuando no se le pasa argumento", () => {
    const resultado = evaluarFormula("CANTIDAD() * 1000", {
      conceptoActual: "HS_EXTRA_50",
      cantidades: { HS_EXTRA_50: 8 },
    });
    expect(resultado).toBe(8000);
  });
});

describe("VALOR_CATEGORIA() — valor fijo por categoría (ej. horas extra de Camioneros)", () => {
  it("multiplica el valor de la categoría por la cantidad cargada", () => {
    const resultado = evaluarFormula("VALOR_CATEGORIA('HS_EXTRA_50') * CANTIDAD()", {
      valoresCategoria: { HS_EXTRA_50: 8405.55 },
      conceptoActual: "HS_EXTRA_50",
      cantidades: { HS_EXTRA_50: 8 },
    });
    expect(resultado).toBeCloseTo(8405.55 * 8, 2);
  });
});

describe("TOPE() — parámetro vigente (ej. tope jubilatorio, SMVM)", () => {
  it("lee el valor del contexto de topes", () => {
    expect(evaluarFormula("TOPE('SMVM')", { topes: { SMVM: 376600 } })).toBe(376600);
  });

  it("tira un error claro si la clave no está cargada — nunca debe devolver 0 en silencio", () => {
    expect(() => evaluarFormula("TOPE('ALGO_QUE_NO_EXISTE')", { topes: {} })).toThrow(/no está definido en el contexto/);
  });
});

describe("REM_TOTAL() — restricción de uso (bug real que encontramos y arreglamos)", () => {
  it("funciona cuando el contexto tiene remTotal (uso correcto: dentro de un descuento)", () => {
    expect(evaluarFormula("REM_TOTAL() * 0.11", { remTotal: 1000000 })).toBe(110000);
  });

  it("tira un error claro si se usa sin remTotal en el contexto — así se detectó el bug de los topes que rompía Jubilación/Ley19032/ObraSocial", () => {
    expect(() => evaluarFormula("REM_TOTAL() * 0.11", {})).toThrow(/solo se puede usar en descuentos/);
  });
});
