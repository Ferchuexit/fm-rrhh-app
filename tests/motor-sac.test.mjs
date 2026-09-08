// tests/motor-sac.test.mjs
import { describe, it, expect } from "vitest";
import { obtenerSemestre, calcularSAC } from "../lib/motor/motor-sac.mjs";

describe("obtenerSemestre", () => {
  it("un mes de enero a junio cae en el 1er semestre", () => {
    const s = obtenerSemestre(new Date("2026-03-15"));
    expect(s.numero).toBe(1);
    expect(s.desde.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(s.hasta.toISOString().slice(0, 10)).toBe("2026-06-30");
  });

  it("un mes de julio a diciembre cae en el 2do semestre", () => {
    const s = obtenerSemestre(new Date("2026-10-15"));
    expect(s.numero).toBe(2);
    expect(s.desde.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(s.hasta.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("calcularSAC — Ley 23.041: 50% de la MEJOR remuneración del semestre", () => {
  it("semestre completo: SAC = mejor remuneración / 2, sin prorratear", () => {
    const sac = calcularSAC({ mejorRemuneracionMensualDelSemestre: 1500000, diasTrabajadosEnSemestre: 181, diasDelSemestre: 181 });
    expect(sac).toBe(750000);
  });

  it("semestre parcial (alta a mitad de semestre): se prorratea por días trabajados", () => {
    const sac = calcularSAC({ mejorRemuneracionMensualDelSemestre: 1500000, diasTrabajadosEnSemestre: 90, diasDelSemestre: 181 });
    expect(sac).toBeCloseTo(750000 * (90 / 181), 2);
  });

  it("cero días trabajados no rompe nada, da 0", () => {
    const sac = calcularSAC({ mejorRemuneracionMensualDelSemestre: 1500000, diasTrabajadosEnSemestre: 0, diasDelSemestre: 181 });
    expect(sac).toBe(0);
  });
});
