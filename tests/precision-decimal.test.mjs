// tests/precision-decimal.test.mjs
//
// El motor de fórmulas ahora hace TODA la aritmética interna con Decimal
// (decimal.js), no con `number` nativo de JS — un float no puede
// representar exactamente la mayoría de los decimales (0.1 + 0.2 no da
// 0.3 en JS), y eso se traduce en centavos que aparecen o desaparecen sin
// motivo tras muchas operaciones encadenadas, como una liquidación real.
//
// Estas pruebas existen específicamente para demostrar el problema que se
// arregló — si algún día alguien "simplifica" el motor volviendo a
// operadores nativos, estas son las primeras que van a fallar.
import { describe, it, expect } from "vitest";
import { evaluarFormula } from "../lib/motor/motor-reglas.mjs";

describe("Precisión — el motor no arrastra el error clásico de float de JS", () => {
  it("0.1 + 0.2 da exactamente 0.3, no 0.30000000000000004", () => {
    // Referencia: así falla JS nativo, sin el motor:
    expect(0.1 + 0.2).not.toBe(0.3); // esto documenta el problema, no lo prueba resuelto
    expect(evaluarFormula("0.1 + 0.2", {})).toBe(0.3);
  });

  it("sumar 0.1 diez veces da exactamente 1, no 0.9999999999999999", () => {
    let formula = "0.1";
    for (let i = 1; i < 10; i++) formula += " + 0.1";
    expect(evaluarFormula(formula, {})).toBe(1);
  });

  it("una cadena larga de multiplicaciones con porcentajes no acumula error", () => {
    // Simula algo parecido a una liquidación real: básico por antigüedad,
    // por una alícuota, dividido entre días — varios pasos encadenados.
    const r = evaluarFormula("(1075910.44 * 20 * 0.01) * 0.11 / 30 * 30", {});
    // Sin ningún error de redondeo, dividir y volver a multiplicar por lo
    // mismo (30) tiene que devolver EXACTAMENTE el valor de antes de dividir.
    const sinDividir = evaluarFormula("1075910.44 * 20 * 0.01 * 0.11", {});
    expect(r).toBe(sinDividir);
  });
});

describe("MIN / MAX / ROUND / ABS con Decimal — mismos resultados que antes", () => {
  it("MIN y MAX eligen bien entre varios valores", () => {
    expect(evaluarFormula("MIN(10, 5, 20)", {})).toBe(5);
    expect(evaluarFormula("MAX(10, 5, 20)", {})).toBe(20);
  });

  it("ROUND redondea a la cantidad de decimales pedida", () => {
    expect(evaluarFormula("ROUND(3.14159, 2)", {})).toBe(3.14);
  });

  it("ABS siempre da positivo", () => {
    expect(evaluarFormula("ABS(-50)", {})).toBe(50);
  });

  it("la división por cero da 0, no Infinity ni NaN (comportamiento a propósito, igual que antes)", () => {
    expect(evaluarFormula("10 / 0", {})).toBe(0);
  });

  it("la potencia funciona igual que antes", () => {
    expect(evaluarFormula("2 ^ 10", {})).toBe(1024);
  });
});
