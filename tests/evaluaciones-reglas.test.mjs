// Evaluación de desempeño (lib/evaluaciones-reglas.ts).
import { describe, it, expect } from "vitest";
import * as E from "../lib/evaluaciones-reglas.ts";

const comp = [{ nombre: "Seguridad" }, { nombre: "Calidad" }, { nombre: "Equipo" }];

describe("Formulario", () => {
  it("el formulario inicial es válido tal como viene", () => {
    const { competencias, error } = E.limpiarCompetencias(E.FORMULARIO_INICIAL.competencias);
    expect(error).toBeNull();
    expect(competencias).toHaveLength(7);
  });
  it("rechaza vacío, sin nombre, repetidas o demasiadas", () => {
    expect(E.limpiarCompetencias([]).error).toMatch(/al menos una/);
    expect(E.limpiarCompetencias([{ nombre: "" }]).error).toMatch(/competencia 1/);
    expect(E.limpiarCompetencias([{ nombre: "Calidad" }, { nombre: "calidad" }]).error).toMatch(/repetida/);
    expect(E.limpiarCompetencias(Array.from({ length: 16 }, (_, i) => ({ nombre: `Competencia ${i}` }))).error).toMatch(/hasta 15/);
  });
});

describe("Puntajes", () => {
  it("se queda solo con notas válidas de las competencias que existen", () => {
    expect(E.limpiarPuntajes({ 0: 4, 1: "3", 2: 9, 3: 5, x: 2 }, 3)).toEqual({ 0: 4, 1: 3 });
    expect(E.limpiarPuntajes(null, 3)).toEqual({});
    expect(E.limpiarPuntajes({ 0: 2.5 }, 3)).toEqual({});
  });
  it("para completar hacen falta todas las notas", () => {
    expect(E.motivoIncompleta(comp, { 0: 4, 1: 3 }, "")).toMatch(/Falta puntuar "Equipo"/);
    expect(E.motivoIncompleta(comp, { 0: 4, 1: 3, 2: 5 }, "")).toBeNull();
  });
  it("una nota baja exige explicar qué mejorar", () => {
    expect(E.motivoIncompleta(comp, { 0: 2, 1: 3, 2: 5 }, "")).toMatch(/A mejorar/);
    expect(E.motivoIncompleta(comp, { 0: 1, 1: 3, 2: 5 }, "mejorar")).toMatch(/A mejorar/);
    expect(E.motivoIncompleta(comp, { 0: 2, 1: 3, 2: 5 }, "Tiene que usar siempre los anteojos de seguridad.")).toBeNull();
  });
  it("promedio con dos decimales", () => {
    expect(E.promedio({ 0: 4, 1: 3, 2: 5 })).toBe(4);
    expect(E.promedio({ 0: 4, 1: 3, 2: 3 })).toBe(3.33);
    expect(E.promedio({})).toBeNull();
    expect(E.promedio(null)).toBeNull();
  });
});

describe("Resumen de un ciclo", () => {
  it("cuenta por estado y promedia solo lo ya completado", () => {
    const r = E.resumenCiclo(comp, [
      { estado: "pendiente", puntajes: null, promedio: null },
      { estado: "completada", puntajes: { 0: 4, 1: 2, 2: 5 }, promedio: 3.67 },
      { estado: "entregada", puntajes: { 0: 5, 1: 3, 2: 4 }, promedio: 4 },
      { estado: "firmada", puntajes: { 0: 3, 1: 4, 2: 3 }, promedio: 3.33 },
    ]);
    expect(r).toMatchObject({ total: 4, pendientes: 1, completadas: 1, entregadas: 1, firmadas: 1, promedioGeneral: 3.67 });
    expect(r.porCompetencia).toEqual([{ nombre: "Seguridad", promedio: 4 }, { nombre: "Calidad", promedio: 3 }, { nombre: "Equipo", promedio: 4 }]);
  });
  it("sin evaluaciones completadas no inventa promedios", () => {
    const r = E.resumenCiclo(comp, [{ estado: "pendiente", puntajes: null, promedio: null }]);
    expect(r.promedioGeneral).toBeNull();
    expect(r.porCompetencia.every((c) => c.promedio === null)).toBe(true);
  });
});
