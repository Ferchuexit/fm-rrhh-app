// Filtros de preselección (lib/reclutamiento-filtros.ts).
import { describe, it, expect } from "vitest";
import * as F from "../lib/reclutamiento-filtros.ts";

const preguntas = [
  { texto: "¿Tenés secundario completo?", tipo: "si_no", excluyente: true, puntos: 2, esperado: "si" },
  { texto: "¿Cuántos años de experiencia en carpintería?", tipo: "numero", excluyente: false, puntos: 3, minimo: 2 },
  { texto: "¿En qué turno podés trabajar?", tipo: "opcion", excluyente: true, puntos: 1, opciones: ["Solo mañana", "Solo tarde", "Rotativo"], aceptadas: [0, 2] },
];
const palabras = ["seccionadora", "autoelevador"];

describe("armar los filtros", () => {
  it("valida cada tipo de pregunta", () => {
    expect(F.limpiarFiltros(preguntas)).toEqual({ preguntas, error: null });
    expect(F.limpiarFiltros(undefined)).toEqual({ preguntas: [], error: null });
    expect(F.limpiarFiltros([{ texto: "abc", tipo: "si_no" }]).error).toMatch(/falta el texto/);
    expect(F.limpiarFiltros([{ texto: "¿Años de experiencia?", tipo: "numero" }]).error).toMatch(/desde qué número/);
    expect(F.limpiarFiltros([{ texto: "¿Qué turno?", tipo: "opcion", opciones: ["Mañana"], aceptadas: [0] }]).error).toMatch(/entre 2 y 8/);
    expect(F.limpiarFiltros([{ texto: "¿Qué turno?", tipo: "opcion", opciones: ["Mañana", "Tarde"], aceptadas: [5] }]).error).toMatch(/qué opciones suman/);
    expect(F.limpiarFiltros(Array.from({ length: 11 }, () => preguntas[0])).error).toMatch(/Hasta 10/);
  });
  it("por defecto: suma el sí, no es excluyente, vale 1 punto", () => {
    expect(F.limpiarFiltros([{ texto: "¿Tenés movilidad propia?", tipo: "si_no" }]).preguntas[0]).toEqual({ texto: "¿Tenés movilidad propia?", tipo: "si_no", excluyente: false, puntos: 1, esperado: "si" });
  });
  it("limpia las palabras clave: sin repetir aunque cambie la tilde o la mayúscula", () => {
    expect(F.limpiarPalabras("Autoelevador, CNC;  soldadura  MIG\nautoelevador, Soldadúra MIG, x")).toEqual(["Autoelevador", "CNC", "soldadura MIG"]);
    expect(F.limpiarPalabras(Array.from({ length: 30 }, (_, i) => `palabra${i}`))).toHaveLength(20);
    expect(F.limpiarPalabras(null)).toEqual([]);
  });
});

describe("responder", () => {
  it("en el formulario público son todas obligatorias y con su rango", () => {
    expect(F.limpiarRespuestasFiltro(preguntas, { 0: "si", 1: "3,5", 2: 2 }, true)).toEqual({ respuestas: { 0: "si", 1: 3.5, 2: 2 }, error: null });
    expect(F.limpiarRespuestasFiltro(preguntas, { 0: "si", 2: 2 }, true).error).toMatch(/años de experiencia/);
    expect(F.limpiarRespuestasFiltro(preguntas, { 0: "quizás", 1: 1, 2: 0 }, true).error).toMatch(/secundario/);
    expect(F.limpiarRespuestasFiltro(preguntas, { 0: "no", 1: 1, 2: 3 }, true).error).toMatch(/turno/);
    expect(F.limpiarRespuestasFiltro(preguntas, { 0: "no", 1: -2, 2: 0 }, true).error).toMatch(/años/);
  });
  it("cargado a mano pueden faltar, pero lo que viene tiene que ser válido", () => {
    expect(F.limpiarRespuestasFiltro(preguntas, {}, false)).toEqual({ respuestas: {}, error: null });
    expect(F.limpiarRespuestasFiltro(preguntas, { 0: "quizás" }, false).error).toMatch(/secundario/);
  });
});

describe("puntaje", () => {
  it("porcentaje de los puntos en juego, y qué excluyentes no cumple", () => {
    // 2 + 3 + 1 de preguntas, + 2 de palabras = 8 puntos
    expect(F.evaluar(preguntas, palabras, { 0: "si", 1: 5, 2: 2 }, "Operaria de SECCIONADORA. Licencia de autoelevador.")).toEqual({ puntajeFiltro: 100, cumpleExcluyentes: true, noCumple: [], palabrasHalladas: ["seccionadora", "autoelevador"] });
    expect(F.evaluar(preguntas, palabras, { 0: "si", 1: 1, 2: 2 }, "Trabajé en una seccionadora")).toMatchObject({ puntajeFiltro: 50, cumpleExcluyentes: true }); // 2+0+1+1 de 8
    expect(F.evaluar(preguntas, palabras, { 0: "no", 1: 5, 2: 1 }, "seccionadora autoelevador")).toEqual({ puntajeFiltro: 63, cumpleExcluyentes: false, noCumple: ["¿Tenés secundario completo?", "¿En qué turno podés trabajar?"], palabrasHalladas: ["seccionadora", "autoelevador"] });
  });
  it("no cumplir algo NO excluyente baja el puntaje pero no marca", () => {
    expect(F.evaluar(preguntas, [], { 0: "si", 1: 0, 2: 0 }, null)).toEqual({ puntajeFiltro: 50, cumpleExcluyentes: true, noCumple: [], palabrasHalladas: [] });
  });
  it("sin texto de CV, las palabras clave no cuentan ni a favor ni en contra", () => {
    expect(F.evaluar(preguntas, palabras, { 0: "si", 1: 5, 2: 2 }, null).puntajeFiltro).toBe(100);
    expect(F.evaluar(preguntas, palabras, { 0: "si", 1: 5, 2: 2 }, "").puntajeFiltro).toBe(100);
  });
  it("busca sin distinguir tildes ni mayúsculas", () => {
    expect(F.evaluar([], ["soldadura", "Tornería"], null, "SOLDADÚRA mig y torneria cnc").palabrasHalladas).toEqual(["soldadura", "Tornería"]);
  });
  it("sin filtros, o cargado a mano sin respuestas ni CV: sin evaluar", () => {
    expect(F.evaluar([], [], { 0: "si" }, "texto")).toMatchObject({ puntajeFiltro: null, cumpleExcluyentes: null });
    expect(F.evaluar(preguntas, palabras, null, null)).toMatchObject({ puntajeFiltro: null, cumpleExcluyentes: null });
    // a mano pero con CV: se evalúan solo las palabras
    expect(F.evaluar(preguntas, palabras, {}, "seccionadora")).toMatchObject({ puntajeFiltro: 50, cumpleExcluyentes: null });
  });
  it("el detalle explica cada respuesta", () => {
    const d = F.detalleRespuestas(preguntas, { 0: "no", 1: 3.5, 2: 2 });
    expect(d.map((x) => [x.respuesta, x.cumple])).toEqual([["No", false], ["3,5", true], ["Rotativo", true]]);
    expect(F.detalleRespuestas(preguntas, null)[0]).toMatchObject({ respuesta: "sin responder", cumple: false });
  });
});

describe("finalistas y orden", () => {
  const c = (id, puntajeFiltro, cumpleExcluyentes, puntaje = null, createdAt = "2026-10-01") => ({ id, puntajeFiltro, cumpleExcluyentes, puntaje, createdAt });
  it("finalista sugerido: llega al umbral y no falla un excluyente", () => {
    expect(F.esFinalistaSugerido(c("a", 70, true))).toBe(true);
    expect(F.esFinalistaSugerido(c("a", 69, true))).toBe(false);
    expect(F.esFinalistaSugerido(c("a", 95, false))).toBe(false);
    expect(F.esFinalistaSugerido(c("a", 80, null))).toBe(true); // solo palabras clave
    expect(F.esFinalistaSugerido(c("a", null, null))).toBe(false);
  });
  it("orden: cumplen por puntaje, después sin evaluar, al fondo los que no cumplen", () => {
    const orden = F.ordenar([c("noCumple95", 95, false), c("sinEvaluar", null, null), c("ochenta", 80, true), c("cien", 100, true), c("ochentaEstrellas", 80, true, 5), c("ochentaViejo", 80, true, null, "2026-09-01")]);
    expect(orden.map((x) => x.id)).toEqual(["cien", "ochentaEstrellas", "ochentaViejo", "ochenta", "sinEvaluar", "noCumple95"]);
  });
});
