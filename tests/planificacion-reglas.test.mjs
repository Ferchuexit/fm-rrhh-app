// Planificación de vacaciones: gente afuera a la vez y costo de un rango (lib/planificacion-reglas.ts).
import { describe, it, expect } from "vitest";
import { diasEnRango, ausentesPorDia, pico, picoPorSemana, referenciaMensual, costoEnRango, presupuestoAplica } from "../lib/planificacion-reglas.ts";

const f = (t) => new Date(t + "T00:00:00Z");
const r = (a, b) => ({ desde: f(a), hasta: f(b) });
const enero = r("2027-01-01", "2027-01-31");

describe("Días dentro del rango", () => {
  it("cuenta solo la parte que cae adentro", () => {
    expect(diasEnRango(r("2027-01-10", "2027-01-16"), enero)).toBe(7);
    expect(diasEnRango(r("2026-12-25", "2027-01-05"), enero)).toBe(5);
    expect(diasEnRango(r("2027-01-28", "2027-02-10"), enero)).toBe(4);
    expect(diasEnRango(r("2026-12-01", "2027-03-01"), enero)).toBe(31);
    expect(diasEnRango(r("2027-02-01", "2027-02-05"), enero)).toBe(0);
    expect(diasEnRango(r("2027-01-31", "2027-01-31"), enero)).toBe(1);
  });
});

describe("Gente afuera a la vez", () => {
  const ausencias = [
    { legajoId: "a", ...r("2027-01-04", "2027-01-10") },
    { legajoId: "b", ...r("2027-01-08", "2027-01-14") },
    { legajoId: "c", ...r("2027-01-09", "2027-01-12"), pendiente: true },
    { legajoId: "a", ...r("2027-01-09", "2027-01-10") }, // registro repetido de la misma persona
  ];
  const dias = ausentesPorDia(enero, ausencias);

  it("cuenta personas, no registros, y separa lo firme de lo pendiente", () => {
    expect(dias).toHaveLength(31);
    const dia = (n) => dias[n - 1];
    expect(dia(3)).toMatchObject({ firmes: 0, conPendientes: 0 });
    expect(dia(5)).toMatchObject({ firmes: 1, conPendientes: 1 });
    expect(dia(9)).toMatchObject({ firmes: 2, conPendientes: 3 });
    expect(dia(12)).toMatchObject({ firmes: 1, conPendientes: 2 });
    expect(dia(15)).toMatchObject({ firmes: 0, conPendientes: 0 });
  });
  it("el pico es el peor día, y dice cuándo empieza", () => {
    expect(pico(dias, "firmes")).toEqual({ cantidad: 2, fecha: f("2027-01-08") });
    expect(pico(dias, "conPendientes")).toEqual({ cantidad: 3, fecha: f("2027-01-09") });
    expect(pico(ausentesPorDia(enero, []), "firmes")).toEqual({ cantidad: 0, fecha: null });
  });
  it("el Gantt corta el año en semanas sin dejar días afuera", () => {
    const semanas = picoPorSemana(2027, ausencias);
    expect(semanas).toHaveLength(53);
    expect(semanas[0].desde).toEqual(f("2027-01-01"));
    expect(semanas.at(-1).hasta).toEqual(f("2027-12-31"));
    expect(semanas[0]).toMatchObject({ firmes: 1, conPendientes: 1 }); // 1 al 7 de enero
    expect(semanas[1]).toMatchObject({ firmes: 2, conPendientes: 3 }); // 8 al 14
    expect(semanas[10]).toMatchObject({ firmes: 0, conPendientes: 0 });
  });
});

describe("Costo", () => {
  it("el sueldo de referencia es el mismo con un mes o con dos quincenas", () => {
    expect(referenciaMensual([{ bruto: 900000, contribuciones: 0, dias: 30 }], null).bruto).toBeCloseTo(900000);
    expect(referenciaMensual([{ bruto: 450000, contribuciones: 0, dias: 15 }, { bruto: 450000, contribuciones: 0, dias: 15 }], null).bruto).toBeCloseTo(900000);
    expect(referenciaMensual([], 25)).toBeNull(); // sin liquidaciones no se inventa un sueldo
  });
  it("contribuciones: primero las liquidadas, después el % de la empresa, y si no hay nada lo dice", () => {
    const conContrib = [{ bruto: 900000, contribuciones: 234000, dias: 30 }];
    const sinContrib = [{ bruto: 900000, contribuciones: 0, dias: 30 }];
    expect(referenciaMensual(conContrib, 30)).toMatchObject({ contribuciones: 234000, origen: "liquidadas" }); // el % no pisa lo liquidado
    expect(referenciaMensual(sinContrib, 26)).toMatchObject({ contribuciones: 234000, origen: "estimadas" });
    expect(referenciaMensual(sinContrib, null)).toMatchObject({ contribuciones: 0, origen: "sin" });
    expect(referenciaMensual(sinContrib, 0)).toMatchObject({ contribuciones: 0, origen: "sin" });
  });
  it("un presupuesto aplica por fechas y por sector", () => {
    const p = { centroCostoId: null, desde: f("2027-01-01"), hasta: f("2027-01-31") };
    expect(presupuestoAplica(p, "taller", r("2027-01-25", "2027-02-05"))).toBe(true); // toda la empresa, se pisa
    expect(presupuestoAplica(p, null, r("2027-02-01", "2027-02-05"))).toBe(false); // otras fechas
    expect(presupuestoAplica({ ...p, centroCostoId: "taller" }, "taller", r("2027-01-10", "2027-01-12"))).toBe(true);
    expect(presupuestoAplica({ ...p, centroCostoId: "taller" }, "ventas", r("2027-01-10", "2027-01-12"))).toBe(false);
    expect(presupuestoAplica({ ...p, centroCostoId: "taller" }, null, r("2027-01-10", "2027-01-12"))).toBe(false);
  });
  it("vacaciones a valor día/25; el adicional es la diferencia con día/30", () => {
    const c = costoEnRango(900000, 30, 14);
    expect(c.masa).toBeCloseTo(900000);
    expect(c.vacaciones).toBeCloseTo(504000); // 900.000 / 25 × 14
    expect(c.adicional).toBeCloseTo(84000); // 504.000 − 900.000 / 30 × 14
    expect(costoEnRango(900000, 15, 0)).toMatchObject({ masa: 450000, vacaciones: 0, adicional: 0 });
  });
});
