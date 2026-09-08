// tests/prorrateo.test.mjs
//
// Hasta esta funcionalidad, DIAS_TRABAJADOS siempre tomaba el período
// completo sin importar si el legajo entró o salió a mitad de mes — un
// alta el 15 de agosto cobraba el mes entero. Estos casos son los mismos
// que se validaron a mano contra el motor real antes de conectar esto a
// /liquidar.
import { describe, it, expect } from "vitest";
import { calcularDiasTrabajadosEnPeriodo } from "../lib/motor/prorrateo.mjs";

const DESDE = new Date("2026-08-01");
const HASTA = new Date("2026-08-31");

describe("calcularDiasTrabajadosEnPeriodo", () => {
  it("trabajó todo el mes — 31 días, sin cambios", () => {
    const dias = calcularDiasTrabajadosEnPeriodo({
      fechaDesdePeriodo: DESDE, fechaHastaPeriodo: HASTA,
      fechaIngresoLegajo: new Date("2020-01-01"), fechaEgresoLegajo: null,
    });
    expect(dias).toBe(31);
  });

  it("alta el 15 de agosto — del 15 al 31 = 17 días", () => {
    const dias = calcularDiasTrabajadosEnPeriodo({
      fechaDesdePeriodo: DESDE, fechaHastaPeriodo: HASTA,
      fechaIngresoLegajo: new Date("2026-08-15"), fechaEgresoLegajo: null,
    });
    expect(dias).toBe(17);
  });

  it("baja el 10 de agosto — del 1 al 10 = 10 días", () => {
    const dias = calcularDiasTrabajadosEnPeriodo({
      fechaDesdePeriodo: DESDE, fechaHastaPeriodo: HASTA,
      fechaIngresoLegajo: new Date("2020-01-01"), fechaEgresoLegajo: new Date("2026-08-10"),
    });
    expect(dias).toBe(10);
  });

  it("alta y baja en el mismo mes — del 5 al 20 = 16 días", () => {
    const dias = calcularDiasTrabajadosEnPeriodo({
      fechaDesdePeriodo: DESDE, fechaHastaPeriodo: HASTA,
      fechaIngresoLegajo: new Date("2026-08-05"), fechaEgresoLegajo: new Date("2026-08-20"),
    });
    expect(dias).toBe(16);
  });

  it("ingreso previo al período — no recorta nada", () => {
    const dias = calcularDiasTrabajadosEnPeriodo({
      fechaDesdePeriodo: DESDE, fechaHastaPeriodo: HASTA,
      fechaIngresoLegajo: new Date("2025-01-01"), fechaEgresoLegajo: null,
    });
    expect(dias).toBe(31);
  });

  it("egreso posterior al período (todavía sigue activo en este período) — no recorta nada", () => {
    const dias = calcularDiasTrabajadosEnPeriodo({
      fechaDesdePeriodo: DESDE, fechaHastaPeriodo: HASTA,
      fechaIngresoLegajo: new Date("2020-01-01"), fechaEgresoLegajo: new Date("2026-09-15"),
    });
    expect(dias).toBe(31);
  });
});

describe("Interacción con el piso del tope jubilatorio (mes parcial NO debe forzar el piso completo)", () => {
  it("con DIAS_TRABAJADOS < DIAS_MES, un sueldo bajo prorrateado NO se fuerza al piso mínimo mensual completo", async () => {
    const { evaluarFormula } = await import("../lib/motor/motor-reglas.mjs");
    const TOPES = { TOPE_JUBILATORIO: 4594798.23, TOPE_JUBILATORIO_MINIMO: 141380.42 };
    const F = "IF(DIAS_TRABAJADOS >= DIAS_MES, MAX(MIN(REM_TOTAL(), TOPE('TOPE_JUBILATORIO')), TOPE('TOPE_JUBILATORIO_MINIMO')), MIN(REM_TOTAL(), TOPE('TOPE_JUBILATORIO')))";

    const parcial = evaluarFormula(F + " * 0.11", { remTotal: 50000, topes: TOPES, vars: { DIAS_TRABAJADOS: 15, DIAS_MES: 30 } });
    expect(parcial).toBeCloseTo(50000 * 0.11, 2); // NO forzado al piso

    const completo = evaluarFormula(F + " * 0.11", { remTotal: 50000, topes: TOPES, vars: { DIAS_TRABAJADOS: 30, DIAS_MES: 30 } });
    expect(completo).toBeCloseTo(141380.42 * 0.11, 2); // SÍ forzado al piso, mes completo
  });
});
