// Offboarding (lib/egresos-reglas.ts).
import { describe, it, expect } from "vitest";
import * as E from "../lib/egresos-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const hoy = d("2026-10-10");

describe("plantilla de egreso", () => {
  it("la plantilla inicial es válida y queda ordenada por día", () => {
    const { tareas, error } = E.limpiarTareasEgreso(E.PLANTILLA_EGRESO_INICIAL.tareas);
    expect(error).toBeNull();
    expect(tareas).toHaveLength(E.PLANTILLA_EGRESO_INICIAL.tareas.length);
    expect(tareas.map((t) => t.dia)).toEqual([...tareas.map((t) => t.dia)].sort((a, b) => a - b));
    for (const t of tareas) if (t.clave) expect(E.CLAVES_EGRESO[t.clave]).toBeTruthy();
  });
  it("no acepta tareas para el empleado, ni días fuera de rango, ni claves inventadas", () => {
    expect(E.limpiarTareasEgreso([{ titulo: "Devolver ropa", responsable: "empleado", dia: 0 }]).error).toMatch(/quién hace/);
    expect(E.limpiarTareasEgreso([{ titulo: "Devolver ropa", responsable: "rrhh", dia: 400 }]).error).toMatch(/día/);
    expect(E.limpiarTareasEgreso([{ titulo: "x", responsable: "rrhh", dia: 0 }]).error).toMatch(/título/);
    expect(E.limpiarTareasEgreso([]).error).toMatch(/al menos una/);
    expect(E.limpiarTareasEgreso([{ titulo: "Baja", responsable: "rrhh", dia: 0, clave: "inventada" }]).tareas[0].clave).toBeUndefined();
  });
  it("etapas: antes, el último día, después", () => {
    const f = d("2026-10-30");
    expect([d("2026-10-27"), f, d("2026-11-02")].map((v) => E.etapaEgreso(f, v))).toEqual(["Antes del último día", "Último día", "Después"]);
  });
});

describe("iniciar un egreso", () => {
  it("pide motivo conocido y una fecha razonable", () => {
    expect(E.validarInicio("vacaciones", hoy, hoy)).toMatch(/motivo/);
    expect(E.validarInicio("renuncia", null, hoy)).toMatch(/último día/);
    expect(E.validarInicio("renuncia", d("2025-01-01"), hoy)).toMatch(/más de un año/);
    expect(E.validarInicio("renuncia", d("2027-06-01"), hoy)).toMatch(/6 meses/);
    expect(E.validarInicio("renuncia", d("2026-09-30"), hoy)).toBeNull(); // uno que ya pasó, para registrar
    expect(E.validarInicio("despido_sin_causa", d("2026-10-31"), hoy)).toBeNull();
  });
});

describe("entrevista de salida", () => {
  it("pide motivo real y si es recontratable; «otro» obliga a comentar", () => {
    expect(E.validarEntrevista({}).error).toMatch(/motivo principal/);
    expect(E.validarEntrevista({ entrevistaMotivo: "sueldo" }).error).toMatch(/volvería a tomar/);
    expect(E.validarEntrevista({ entrevistaMotivo: "otro", recontratable: "si" }).error).toMatch(/Otro/);
    expect(E.validarEntrevista({ entrevistaMotivo: "sueldo", recontratable: "si", entrevistaComentario: "  " })).toEqual({ datos: { entrevistaMotivo: "sueldo", recontratable: "si", entrevistaComentario: null }, error: null });
  });
});

describe("rotación", () => {
  it("cuenta por motivo formal y real, sin los cancelados", () => {
    const r = E.resumenRotacion([
      { estado: "completado", motivo: "renuncia", entrevistaMotivo: "sueldo", recontratable: "si" },
      { estado: "en_curso", motivo: "renuncia", entrevistaMotivo: "sueldo", recontratable: "no" },
      { estado: "completado", motivo: "renuncia", entrevistaMotivo: "jefe", recontratable: "si" },
      { estado: "completado", motivo: "despido_sin_causa", entrevistaMotivo: null, recontratable: null },
      { estado: "cancelado", motivo: "renuncia", entrevistaMotivo: "sueldo", recontratable: "si" },
    ]);
    expect(r).toMatchObject({ total: 4, voluntarios: 3, conEntrevista: 3, recontratables: 2 });
    expect(r.porMotivo[0]).toEqual({ clave: "renuncia", nombre: "Renuncia", cantidad: 3 });
    expect(r.porMotivoReal.map((m) => [m.clave, m.cantidad])).toEqual([["sueldo", 2], ["jefe", 1]]);
  });
  it("sin egresos da todo en cero", () => {
    expect(E.resumenRotacion([])).toMatchObject({ total: 0, voluntarios: 0, porMotivo: [], conEntrevista: 0 });
  });
});
