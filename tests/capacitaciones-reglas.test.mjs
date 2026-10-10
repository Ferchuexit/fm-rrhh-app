// Capacitaciones y matriz de habilidades (lib/capacitaciones-reglas.ts).
import { describe, it, expect } from "vitest";
import * as C from "../lib/capacitaciones-reglas.ts";

const f = (t) => new Date(t + "T00:00:00Z");
const hoy = f("2026-10-10");

describe("Vencimientos", () => {
  it("se cuentan en meses desde la fecha de la capacitación", () => {
    expect(C.vencimientoDe(f("2026-10-10"), 12)).toEqual(f("2027-10-10"));
    expect(C.vencimientoDe(f("2026-10-10"), 6)).toEqual(f("2027-04-10"));
    expect(C.vencimientoDe(f("2026-10-10"), null)).toBeNull();
    expect(C.vencimientoDe(f("2026-10-10"), 0)).toBeNull();
  });
  it("fin de mes: no se pasa al mes siguiente", () => {
    expect(C.vencimientoDe(f("2026-08-31"), 6)).toEqual(f("2027-02-28"));
    expect(C.vencimientoDe(f("2027-08-31"), 6)).toEqual(f("2028-02-29")); // bisiesto
    expect(C.vencimientoDe(f("2026-01-31"), 1)).toEqual(f("2026-02-28"));
  });
  it("vigente, por vencer (60 días) o vencida", () => {
    expect(C.estadoHabilidad(null, hoy)).toBe("vigente");
    expect(C.estadoHabilidad(f("2027-06-01"), hoy)).toBe("vigente");
    expect(C.estadoHabilidad(f("2026-12-09"), hoy)).toBe("por_vencer");
    expect(C.estadoHabilidad(f("2026-12-10"), hoy)).toBe("vigente");
    expect(C.estadoHabilidad(hoy, hoy)).toBe("por_vencer"); // vence hoy: todavía vale
    expect(C.estadoHabilidad(f("2026-10-09"), hoy)).toBe("vencida");
  });
});

describe("Cobertura de un puesto", () => {
  const c = (nivel, vence = null) => ({ nivel, vence: vence ? f(vence) : null });
  it("cuenta solo a los autónomos con la habilitación vigente", () => {
    expect(C.cobertura([c(4), c(3), c(2), c(1), c(3, "2026-01-01")], hoy)).toEqual({ autonomos: 2, enFormacion: 2, vencidas: 1, riesgo: false });
  });
  it("con uno solo (o ninguno) hay riesgo", () => {
    expect(C.cobertura([c(3), c(2)], hoy).riesgo).toBe(true);
    expect(C.cobertura([], hoy)).toMatchObject({ autonomos: 0, riesgo: true });
    expect(C.cobertura([c(3), c(4, "2026-09-30")], hoy)).toMatchObject({ autonomos: 1, riesgo: true }); // el instructor está vencido
  });
});

describe("Efecto de una capacitación en la matriz", () => {
  it("sube el nivel, o lo deja si ya tenía más; siempre renueva la fecha", () => {
    expect(C.trasCapacitar(null, 2, hoy, 12)).toEqual({ nivel: 2, desde: hoy, vence: f("2027-10-10") });
    expect(C.trasCapacitar({ nivel: 1 }, 3, hoy, null)).toEqual({ nivel: 3, desde: hoy, vence: null });
    expect(C.trasCapacitar({ nivel: 4 }, 3, hoy, 12)).toMatchObject({ nivel: 4, vence: f("2027-10-10") }); // recapacitación de un instructor
  });
});

describe("Validaciones", () => {
  it("habilidad", () => {
    expect(C.validarHabilidad({ nombre: "Autoelevador", grupo: "Máquinas", vigenciaMeses: "12" })).toEqual({ datos: { nombre: "Autoelevador", grupo: "Máquinas", vigenciaMeses: 12 }, error: null });
    expect(C.validarHabilidad({ nombre: "Seccionadora" }).datos).toEqual({ nombre: "Seccionadora", grupo: "General", vigenciaMeses: null });
    expect(C.validarHabilidad({ nombre: "A" }).error).toMatch(/nombre/);
    expect(C.validarHabilidad({ nombre: "Altura", vigenciaMeses: 1.5 }).error).toMatch(/meses/);
    expect(C.validarHabilidad({ nombre: "Altura", vigenciaMeses: 500 }).error).toMatch(/meses/);
  });
  it("capacitación", () => {
    const ok = { titulo: "Uso de autoelevador", tipo: "seguridad", horas: 4, habilidadId: "h", nivelOtorgado: 3, legajoIds: ["a"] };
    expect(C.validarCapacitacion(ok, hoy)).toBeNull();
    expect(C.validarCapacitacion({ ...ok, habilidadId: null, nivelOtorgado: null, horas: "" }, hoy)).toBeNull();
    expect(C.validarCapacitacion({ ...ok, titulo: "" }, hoy)).toMatch(/título/);
    expect(C.validarCapacitacion(ok, null)).toMatch(/fecha/);
    expect(C.validarCapacitacion({ ...ok, tipo: "x" }, hoy)).toMatch(/tipo/);
    expect(C.validarCapacitacion({ ...ok, horas: -1 }, hoy)).toMatch(/horas/);
    expect(C.validarCapacitacion({ ...ok, nivelOtorgado: 9 }, hoy)).toMatch(/nivel/);
    expect(C.validarCapacitacion({ ...ok, legajoIds: [] }, hoy)).toMatch(/asistente/);
  });
});
