// tests/motor-overrides.test.mjs
//
// Soporte de "overrides" en liquidarLegajo — la base de Liquidación
// Individual (rediseño del módulo, puntos 4 y 5): forzar el importe
// EFECTIVO de un concepto que tiene regla, dejando que todo lo que
// depende de él (aportes, contribuciones, neto) recalcule en cascada
// usando el valor forzado — sin dejar de evaluar la fórmula original,
// que sigue viajando en importeCalculado para poder mostrar "normal vs.
// forzado" en la pantalla.
import { describe, it, expect } from "vitest";
import { liquidarLegajo } from "../lib/motor/motor-reglas.mjs";

describe("liquidarLegajo — overrides (forzar importe desde Liquidación Individual)", () => {
  const conceptos = [
    { codigo: "REM_BASICA", tipo: "remunerativo" },
    { codigo: "PRESENTISMO", tipo: "remunerativo" },
    { codigo: "JUBILACION", tipo: "descuento" },
  ];
  const reglas = [
    { conceptoCodigo: "REM_BASICA", formula: "BASICO", aporta: true, contribuye: true },
    { conceptoCodigo: "PRESENTISMO", formula: "CONCEPTO('REM_BASICA') * 0.0833", aporta: true, contribuye: true },
    { conceptoCodigo: "JUBILACION", formula: "REM_TOTAL() * 0.11", aporta: false, contribuye: false },
  ];
  const varsBase = { BASICO: 1000000 };

  it("sin overrides, se comporta exactamente igual que siempre (sin regresión)", () => {
    const resultado = liquidarLegajo({ varsBase, conceptos, reglas });
    const presentismo = resultado.detalle.find((d) => d.conceptoCodigo === "PRESENTISMO");
    expect(presentismo.importe).toBeCloseTo(1000000 * 0.0833, 2);
    expect(presentismo.forzado).toBe(false);
    expect(presentismo.importeCalculado).toBeNull();
  });

  it("forzar Presentismo reemplaza su importe efectivo, y conserva el valor de fórmula aparte", () => {
    const resultado = liquidarLegajo({ varsBase, conceptos, reglas, overrides: { PRESENTISMO: 75000 } });
    const presentismo = resultado.detalle.find((d) => d.conceptoCodigo === "PRESENTISMO");
    expect(presentismo.importe).toBe(75000);
    expect(presentismo.forzado).toBe(true);
    expect(presentismo.importeCalculado).toBeCloseTo(1000000 * 0.0833, 2); // lo que la fórmula hubiera dado
  });

  it("el forzado cascadea a lo que depende del concepto (Jubilación, bruto y neto)", () => {
    const normal = liquidarLegajo({ varsBase, conceptos, reglas });
    const forzado = liquidarLegajo({ varsBase, conceptos, reglas, overrides: { PRESENTISMO: 75000 } });

    const jubNormal = normal.detalle.find((d) => d.conceptoCodigo === "JUBILACION").importe;
    const jubForzada = forzado.detalle.find((d) => d.conceptoCodigo === "JUBILACION").importe;

    // Presentismo normal ($83.300) vs forzado ($75.000): la Jubilación (11%
    // del REM_TOTAL) tiene que reflejar la diferencia, no quedarse con el
    // valor de la fórmula original.
    expect(jubForzada).toBeLessThan(jubNormal);
    expect(forzado.bruto).toBeLessThan(normal.bruto);
    expect(forzado.neto).toBeLessThan(normal.neto);
  });

  it("forzar un concepto en $0 equivale a excluirlo del bruto sin romper lo que depende de él", () => {
    const resultado = liquidarLegajo({ varsBase, conceptos, reglas, overrides: { PRESENTISMO: 0 } });
    const presentismo = resultado.detalle.find((d) => d.conceptoCodigo === "PRESENTISMO");
    const jubilacion = resultado.detalle.find((d) => d.conceptoCodigo === "JUBILACION");
    expect(presentismo.importe).toBe(0);
    expect(resultado.bruto).toBe(1000000); // solo REM_BASICA
    expect(jubilacion.importe).toBeCloseTo(1000000 * 0.11, 2); // Jubilación ya no incluye el Presentismo excluido
  });
});
