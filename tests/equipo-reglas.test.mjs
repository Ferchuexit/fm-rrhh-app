// Jerarquía "reporta a" y quién pide las vacaciones (lib/equipo-reglas.ts).
import { describe, it, expect } from "vitest";
import { motivoJefeInvalido, puedePedirParaSi } from "../lib/equipo-reglas.ts";
import { validarPedido, fechaDesdeTexto } from "../lib/ausencias-reglas.ts";

// gerente ← jefe ← operario ; suelto no reporta a nadie
const jefeDe = new Map([["gerente", null], ["jefe", "gerente"], ["operario", "jefe"], ["suelto", null]]);

describe("Reporta a", () => {
  it("acepta un jefe válido", () => {
    expect(motivoJefeInvalido("suelto", "jefe", jefeDe)).toBeNull();
    expect(motivoJefeInvalido("operario", "gerente", jefeDe)).toBeNull();
    expect(motivoJefeInvalido(null, "operario", jefeDe)).toBeNull(); // legajo nuevo
  });
  it("rechaza reportarse a sí mismo y a un legajo de otra empresa", () => {
    expect(motivoJefeInvalido("jefe", "jefe", jefeDe)).toMatch(/sí misma/);
    expect(motivoJefeInvalido("jefe", "de-otra-empresa", jefeDe)).toMatch(/no es un legajo/);
    expect(motivoJefeInvalido(null, "de-otra-empresa", jefeDe)).toMatch(/no es un legajo/);
  });
  it("rechaza los círculos, directos e indirectos", () => {
    expect(motivoJefeInvalido("gerente", "jefe", jefeDe)).toMatch(/círculo/);
    expect(motivoJefeInvalido("gerente", "operario", jefeDe)).toMatch(/círculo/);
  });
  it("no se cuelga si la base ya trae un círculo", () => {
    const roto = new Map([["a", "b"], ["b", "a"], ["c", null]]);
    expect(motivoJefeInvalido("c", "a", roto)).toBeNull();
  });
});

describe("Quién pide", () => {
  it("con jefe: las vacaciones no se piden para uno mismo; los permisos sí", () => {
    expect(puedePedirParaSi("vacaciones", true)).toBe(false);
    expect(puedePedirParaSi("permiso", true)).toBe(true);
  });
  it("sin jefe: todo como siempre", () => {
    expect(puedePedirParaSi("vacaciones", false)).toBe(true);
    expect(puedePedirParaSi("permiso", false)).toBe(true);
  });
  it("el jefe solo pide vacaciones para su equipo, y los avisos hablan de la otra persona", () => {
    const f = fechaDesdeTexto;
    const base = { desde: f("2026-11-02"), hasta: f("2026-11-15"), motivo: "trámite personal", hoy: f("2026-10-09"), ocupados: [], paraOtro: true };
    expect(validarPedido({ ...base, tipo: "permiso", saldoDisponible: 14 })).toMatch(/solo se piden vacaciones/);
    expect(validarPedido({ ...base, tipo: "vacaciones", saldoDisponible: 14 })).toBeNull();
    expect(validarPedido({ ...base, tipo: "vacaciones", saldoDisponible: 7 })).toMatch(/a esa persona le quedan 7/);
    expect(validarPedido({ ...base, tipo: "vacaciones", saldoDisponible: 0 })).toMatch(/A esa persona no le quedan/);
  });
});
