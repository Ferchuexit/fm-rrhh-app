// Onboarding: plantillas, vencimientos, avance y quién puede tildar qué (lib/ingresos-reglas.ts).
import { describe, it, expect } from "vitest";
import * as I from "../lib/ingresos-reglas.ts";

const f = (t) => new Date(t + "T00:00:00Z");

describe("Plantilla", () => {
  it("la plantilla inicial es válida tal como viene", () => {
    const { tareas, error } = I.limpiarTareas(I.PLANTILLA_INICIAL.tareas);
    expect(error).toBeNull();
    expect(tareas).toHaveLength(I.PLANTILLA_INICIAL.tareas.length);
    for (const r of ["rrhh", "jefe", "empleado"]) expect(tareas.some((t) => t.responsable === r), r).toBe(true);
    for (const t of tareas) if (t.clave) expect(t.clave in I.CLAVES_AUTOMATICAS, t.clave).toBe(true);
  });
  it("ordena por día y conserva el orden de carga dentro del mismo día", () => {
    const { tareas } = I.limpiarTareas([
      { titulo: "Al mes", responsable: "jefe", dia: 30 }, { titulo: "Primero del día 0", responsable: "rrhh", dia: 0 },
      { titulo: "Antes", responsable: "rrhh", dia: -2 }, { titulo: "Segundo del día 0", responsable: "jefe", dia: 0 },
    ]);
    expect(tareas.map((t) => t.titulo)).toEqual(["Antes", "Primero del día 0", "Segundo del día 0", "Al mes"]);
  });
  it("rechaza lo mal cargado, con un mensaje que dice qué", () => {
    expect(I.limpiarTareas([]).error).toMatch(/al menos una/);
    expect(I.limpiarTareas(null).error).toMatch(/al menos una/);
    expect(I.limpiarTareas([{ titulo: "", responsable: "rrhh", dia: 0 }]).error).toMatch(/tarea 1.*título/);
    expect(I.limpiarTareas([{ titulo: "Algo", responsable: "gerente", dia: 0 }]).error).toMatch(/quién hace "Algo"/);
    expect(I.limpiarTareas([{ titulo: "Algo", responsable: "rrhh", dia: 1.5 }]).error).toMatch(/día de "Algo"/);
    expect(I.limpiarTareas([{ titulo: "Algo", responsable: "rrhh", dia: 9999 }]).error).toMatch(/día/);
    expect(I.limpiarTareas(Array.from({ length: 61 }, () => ({ titulo: "Tarea", responsable: "rrhh", dia: 0 }))).error).toMatch(/hasta 60/);
  });
  it("descarta una comprobación automática que no existe", () => {
    const { tareas } = I.limpiarTareas([{ titulo: "Algo", responsable: "rrhh", dia: 0, clave: "inventada" }, { titulo: "Otra", responsable: "rrhh", dia: 0, clave: "horario" }]);
    expect(tareas[0].clave).toBeUndefined();
    expect(tareas[1].clave).toBe("horario");
  });
});

describe("Vencimientos y etapas", () => {
  const ingreso = f("2026-11-02");
  it("se cuentan desde la fecha de ingreso", () => {
    expect(I.vencimiento(ingreso, -2)).toEqual(f("2026-10-31"));
    expect(I.vencimiento(ingreso, 0)).toEqual(ingreso);
    expect(I.vencimiento(ingreso, 30)).toEqual(f("2026-12-02"));
  });
  it("cada tarea cae en su etapa", () => {
    const etapa = (d) => I.etapaDe(ingreso, I.vencimiento(ingreso, d));
    expect([-2, 0, 1, 7, 8, 30, 31, 150].map(etapa)).toEqual(["Antes del ingreso", "Primer día", "Primera semana", "Primera semana", "Primer mes", "Primer mes", "Después", "Después"]);
  });
});

describe("Avance", () => {
  const hoy = f("2026-11-05");
  const t = (estado, vence, responsable = "rrhh") => ({ estado, vence: f(vence), responsable });
  it("cuenta resueltas y vencidas, y de quién son", () => {
    const p = I.progreso([t("hecha", "2026-11-01"), t("no_aplica", "2026-11-02"), t("pendiente", "2026-11-03", "jefe"), t("pendiente", "2026-11-04", "empleado"), t("pendiente", "2026-11-05"), t("pendiente", "2026-12-02")], hoy);
    expect(p).toMatchObject({ total: 6, resueltas: 2, porcentaje: 33, vencidas: 2, completo: false });
    expect(p.vencidasDe).toEqual({ rrhh: 0, jefe: 1, empleado: 1 }); // la que vence HOY todavía no está vencida
  });
  it("completo cuando no queda nada pendiente ('no aplica' cuenta como resuelta)", () => {
    expect(I.progreso([t("hecha", "2026-11-01"), t("no_aplica", "2026-11-02")], hoy)).toMatchObject({ porcentaje: 100, completo: true, vencidas: 0 });
    expect(I.progreso([], hoy)).toMatchObject({ porcentaje: 100, completo: true });
  });
});

describe("Quién puede tildar", () => {
  it("RR.HH. todas; jefe y empleado, solo las suyas y que no sean automáticas", () => {
    expect(I.puedeMarcar("rrhh", { responsable: "jefe", clave: "horario" })).toBe(true);
    expect(I.puedeMarcar("jefe", { responsable: "jefe", clave: null })).toBe(true);
    expect(I.puedeMarcar("jefe", { responsable: "rrhh", clave: null })).toBe(false);
    expect(I.puedeMarcar("empleado", { responsable: "empleado", clave: null })).toBe(true);
    expect(I.puedeMarcar("empleado", { responsable: "empleado", clave: "pin_propio" })).toBe(false);
    expect(I.puedeMarcar("empleado", { responsable: "jefe", clave: null })).toBe(false);
  });
});
