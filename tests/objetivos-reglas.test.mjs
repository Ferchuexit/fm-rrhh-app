import { describe, it, expect } from "vitest";
import { validarObjetivo, limpiarAvance, semaforo, resumenObjetivos, limpiarRequisitos, brecha } from "../lib/objetivos-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const hoy = d("2026-10-10");

describe("objetivos", () => {
  it("pide título y una fecha de hoy en adelante", () => {
    expect(validarObjetivo({ titulo: "abc" }, d("2026-12-01"), hoy).error).toMatch(/objetivo/);
    expect(validarObjetivo({ titulo: "Bajar el scrap" }, null, hoy).error).toMatch(/cuándo/);
    expect(validarObjetivo({ titulo: "Bajar el scrap" }, d("2026-10-09"), hoy).error).toMatch(/hoy en adelante/);
    expect(validarObjetivo({ titulo: "  Bajar el scrap  ", descripcion: " " }, hoy, hoy)).toEqual({ datos: { titulo: "Bajar el scrap", descripcion: null }, error: null });
  });
  it("el avance es un entero de 0 a 100", () => {
    expect(limpiarAvance("40")).toBe(40);
    expect(limpiarAvance(100)).toBe(100);
    for (const malo of [-1, 101, 12.5, "x", null]) expect(limpiarAvance(malo)).toBeNull();
  });
  it("semáforo: vencido, por vencer (15 días), en fecha, cerrado", () => {
    expect(semaforo({ estado: "en_curso", fechaLimite: d("2026-10-09") }, hoy)).toBe("vencido");
    expect(semaforo({ estado: "en_curso", fechaLimite: hoy }, hoy)).toBe("por_vencer");
    expect(semaforo({ estado: "en_curso", fechaLimite: d("2026-10-25") }, hoy)).toBe("por_vencer");
    expect(semaforo({ estado: "en_curso", fechaLimite: d("2026-10-26") }, hoy)).toBe("en_fecha");
    expect(semaforo({ estado: "cumplido", fechaLimite: d("2026-01-01") }, hoy)).toBe("cerrado");
  });
  it("el cumplimiento no cuenta los cancelados ni los que siguen en curso", () => {
    const r = resumenObjetivos([
      { estado: "cumplido", fechaLimite: hoy }, { estado: "cumplido", fechaLimite: hoy }, { estado: "no_cumplido", fechaLimite: hoy },
      { estado: "cancelado", fechaLimite: hoy }, { estado: "en_curso", fechaLimite: d("2026-09-01") }, { estado: "en_curso", fechaLimite: d("2027-01-01") },
    ], hoy);
    expect(r).toEqual({ enCurso: 2, vencidos: 1, cumplidos: 2, noCumplidos: 1, cumplimiento: 67 });
    expect(resumenObjetivos([{ estado: "en_curso", fechaLimite: hoy }], hoy).cumplimiento).toBeNull();
  });
});

describe("plan de carrera", () => {
  const validas = new Set(["torno", "cnc", "altura"]);
  it("limpia los requisitos: habilidades que existen, nivel 1 a 4, sin repetir", () => {
    expect(limpiarRequisitos([{ habilidadId: "torno", nivel: 3 }, { habilidadId: "torno", nivel: 4 }, { habilidadId: "cnc", nivel: "2" }], validas).requisitos).toEqual([{ habilidadId: "torno", nivel: 3 }, { habilidadId: "cnc", nivel: 2 }]);
    expect(limpiarRequisitos([{ habilidadId: "otra", nivel: 3 }], validas).error).toMatch(/ya no existe/);
    expect(limpiarRequisitos([{ habilidadId: "cnc", nivel: 5 }], validas).error).toMatch(/1 a 4/);
    expect(limpiarRequisitos(undefined, validas)).toEqual({ requisitos: [], error: null });
  });
  it("brecha: compara con la matriz; lo vencido no cuenta", () => {
    const b = brecha(
      [{ habilidadId: "torno", nivel: 3 }, { habilidadId: "cnc", nivel: 3 }, { habilidadId: "altura", nivel: 2 }],
      [{ habilidadId: "torno", nivel: 4, vence: null }, { habilidadId: "cnc", nivel: 2, vence: null }, { habilidadId: "altura", nivel: 3, vence: d("2026-09-01") }],
      hoy,
    );
    expect(b.detalle.map((x) => x.cumple)).toEqual([true, false, false]);
    expect(b.detalle[2].vencida).toBe(true);
    expect(b).toMatchObject({ cumplidos: 1, total: 3, porcentaje: 33 });
    expect(brecha([{ habilidadId: "cnc", nivel: 1 }], [], hoy).detalle[0]).toMatchObject({ actual: 0, cumple: false });
    expect(brecha([], [], hoy).porcentaje).toBeNull();
  });
});
