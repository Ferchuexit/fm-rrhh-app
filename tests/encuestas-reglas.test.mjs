// Encuestas de clima (lib/encuestas-reglas.ts).
import { describe, it, expect } from "vitest";
import * as E from "../lib/encuestas-reglas.ts";

const preguntas = [
  { tipo: "escala", dimension: "Liderazgo", texto: "Mi jefe me trata con respeto." },
  { tipo: "escala", dimension: "Condiciones", texto: "Tengo las herramientas que necesito." },
  { tipo: "enps", texto: "¿Recomendarías trabajar acá?" },
  { tipo: "opcion", texto: "¿En qué turno trabajás?", opciones: ["Mañana", "Tarde", "Noche"] },
  { tipo: "texto", texto: "¿Qué cambiarías?" },
];
const r = (sector, a, b, n, o, t) => ({ sector, respuestas: { 0: a, 1: b, 2: n, 3: o, ...(t ? { 4: t } : {}) } });

describe("armar la encuesta", () => {
  it("las plantillas son válidas tal como vienen", () => {
    for (const p of E.PLANTILLAS_ENCUESTA) {
      const { preguntas: limpias, error } = E.limpiarPreguntas(p.preguntas);
      expect(error).toBeNull();
      expect(limpias).toHaveLength(p.preguntas.length);
    }
  });
  it("rechaza lo mal armado", () => {
    expect(E.limpiarPreguntas([]).error).toMatch(/al menos una/);
    expect(E.limpiarPreguntas([{ texto: "abc", tipo: "escala" }]).error).toMatch(/pregunta 1/);
    expect(E.limpiarPreguntas([{ texto: "Una pregunta", tipo: "otra" }]).error).toMatch(/tipo/);
    expect(E.limpiarPreguntas([{ texto: "¿Turno?", tipo: "opcion", opciones: ["Mañana", " Mañana ", ""] }]).error).toMatch(/entre 2 y 8/);
    expect(E.limpiarPreguntas([{ texto: "Contanos algo", tipo: "texto" }]).error).toMatch(/se pueden medir/);
    expect(E.limpiarPreguntas(Array.from({ length: 41 }, () => ({ texto: "Una pregunta", tipo: "escala" }))).error).toMatch(/hasta 40/);
  });
  it("la dimensión solo vale en preguntas de escala", () => {
    expect(E.limpiarPreguntas([{ texto: "¿Recomendarías?", tipo: "enps", dimension: "X" }]).preguntas[0]).toEqual({ texto: "¿Recomendarías?", tipo: "enps" });
  });
});

describe("responder", () => {
  it("todo lo que no es texto libre es obligatorio y tiene su rango", () => {
    expect(E.limpiarRespuestas(preguntas, { 0: 4, 1: 5, 2: 10, 3: 2 })).toEqual({ respuestas: { 0: 4, 1: 5, 2: 10, 3: 2 }, error: null });
    expect(E.limpiarRespuestas(preguntas, { 0: 4, 1: 5, 2: 0, 3: 0, 4: "  Más luz  " }).respuestas).toEqual({ 0: 4, 1: 5, 2: 0, 3: 0, 4: "Más luz" });
    expect(E.limpiarRespuestas(preguntas, { 0: 4, 2: 10, 3: 2 }).error).toMatch(/herramientas/);
    expect(E.limpiarRespuestas(preguntas, { 0: 6, 1: 5, 2: 10, 3: 2 }).error).toMatch(/respeto/);
    expect(E.limpiarRespuestas(preguntas, { 0: 4, 1: 5, 2: 11, 3: 2 }).error).toMatch(/Recomendarías/);
    expect(E.limpiarRespuestas(preguntas, { 0: 4, 1: 5, 2: 10, 3: 3 }).error).toMatch(/turno/);
    expect(E.limpiarRespuestas(preguntas, { 0: 4, 1: 5, 2: null, 3: 0 }).error).toMatch(/Recomendarías/); // null no es un 0
    expect(E.limpiarRespuestas(preguntas, null).error).toBeTruthy();
  });
});

describe("resultados", () => {
  const seis = [r("Taller", 5, 4, 10, 0, "Más luz"), r("Taller", 4, 4, 9, 0), r("Taller", 5, 2, 8, 1, "Los turnos"), r("Taller", 3, 2, 6, 1), r("Taller", 4, 3, 3, 2), r("Ventas", 1, 1, 0, 0, "Todo")];

  it("con menos del mínimo no muestra nada", () => {
    const res = E.resultados(preguntas, seis.slice(0, 4), "x");
    expect(res).toEqual({ total: 4, suficientes: false, minimo: 5 });
  });
  it("promedio, favorables, dimensiones (peor primero) y distribución", () => {
    const res = E.resultados(preguntas, seis, "x");
    expect(res.suficientes).toBe(true);
    expect(res.porPregunta[0]).toMatchObject({ promedio: 3.67, favorable: 67, distribucion: [1, 0, 1, 2, 2], respondieron: 6 });
    expect(res.porDimension.map((d) => d.nombre)).toEqual(["Condiciones", "Liderazgo"]);
    expect(res.porDimension[0]).toMatchObject({ promedio: 2.67, favorable: 33 });
    expect(res.promedio).toBe(3.17);
    expect(res.porPregunta[3].distribucion).toEqual([3, 2, 1]);
  });
  it("eNPS: promotores menos detractores", () => {
    expect(E.resultados(preguntas, seis, "x").enps).toEqual({ promotores: 2, pasivos: 1, detractores: 3, puntaje: -17 });
  });
  it("un sector con pocas respuestas no muestra su resultado", () => {
    const tres = (sector) => [r(sector, 2, 2, 5, 0), r(sector, 3, 3, 5, 0), r(sector, 2, 2, 5, 0)];
    const res = E.resultados(preguntas, [...seis.slice(0, 5), ...tres("Ventas"), ...tres("Depósito")], "x");
    expect(res.porSector).toEqual([
      { sector: "Depósito", respuestas: 3, visible: false, promedio: null, favorable: null },
      { sector: "Taller", respuestas: 5, visible: true, promedio: 3.6, favorable: 60 },
      { sector: "Ventas", respuestas: 3, visible: false, promedio: null, favorable: null },
    ]);
  });
  it("si restando del general se deduce un sector chico, no se abre por sector para nadie", () => {
    // Taller 5 + Ventas 1: general − Taller = la respuesta del único de Ventas.
    const res = E.resultados(preguntas, seis, "x");
    expect(res.porSector.map((s) => s.visible)).toEqual([false, false]);
    expect(res.promedio).toBe(3.17); // el general sí
  });
  it("los comentarios salen todos, desordenados siempre igual", () => {
    const a = E.resultados(preguntas, seis, "enc-1").porPregunta[4].comentarios;
    expect([...a].sort()).toEqual(["Los turnos", "Más luz", "Todo"]);
    expect(E.resultados(preguntas, seis, "enc-1").porPregunta[4].comentarios).toEqual(a);
  });
});
