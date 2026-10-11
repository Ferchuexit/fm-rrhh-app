// Cumpleaños, aniversarios y reconocimientos (lib/cultura-reglas.ts).
import { describe, it, expect } from "vitest";
import * as C from "../lib/cultura-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const p = (id, nac, ing, extra = {}) => ({ id, nombre: id, apellido: "X", sector: "Taller", jefeId: null, fechaNacimiento: nac ? d(nac) : null, fechaIngreso: d(ing), ocultarCumple: false, ...extra });

describe("cumpleaños y aniversarios", () => {
  const hoy = d("2026-10-11");
  it("los de hoy: cumple sin edad, aniversario con los años", () => {
    const hoyFestejan = C.celebraciones([p("ana", "1990-10-11", "2020-03-01"), p("luis", "1985-01-05", "2021-10-11"), p("nuevo", null, "2026-10-11")], hoy, 0, true);
    expect(hoyFestejan.map((c) => [c.legajoId, c.tipo, c.anios, c.faltan])).toEqual([["ana", "cumple", null, 0], ["luis", "aniversario", 5, 0]]);
    expect(hoyFestejan[1].hito).toBe(true);
    expect(JSON.stringify(hoyFestejan)).not.toContain("1990"); // el año de nacimiento no sale
  });
  it("quien entra hoy no cumple aniversario; al año, sí", () => {
    expect(C.celebraciones([p("nuevo", null, "2026-10-11")], hoy, 0, true)).toEqual([]);
    expect(C.celebraciones([p("nuevo", null, "2025-10-11")], hoy, 0, true)[0]).toMatchObject({ anios: 1, hito: true });
  });
  it("próximos días, en orden, cruzando el fin de año", () => {
    const lista = C.celebraciones([p("enero", "1990-01-03", "2024-06-01"), p("dic", "1991-12-30", "2024-06-01"), p("lejos", "1991-05-30", "2024-06-01")], d("2026-12-28"), 10, true);
    expect(lista.map((c) => [c.legajoId, c.fecha.toISOString().slice(0, 10), c.faltan])).toEqual([["dic", "2026-12-30", 2], ["enero", "2027-01-03", 6]]);
  });
  it("el 29 de febrero se festeja el 28 en años no bisiestos", () => {
    expect(C.fechaEnAnio(d("1992-02-29"), 2027).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(C.fechaEnAnio(d("1992-02-29"), 2028).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(C.celebraciones([p("bisiesto", "1992-02-29", "2020-01-01")], d("2027-02-28"), 0, true)).toHaveLength(1);
  });
  it("quien pidió ocultar su cumpleaños no sale para los compañeros, pero su aniversario sí", () => {
    const personas = [p("reservado", "1990-10-11", "2021-10-11", { ocultarCumple: true })];
    expect(C.celebraciones(personas, hoy, 0, true).map((c) => c.tipo)).toEqual(["aniversario"]);
    expect(C.celebraciones(personas, hoy, 0, false).map((c) => c.tipo)).toEqual(["cumple", "aniversario"]); // RR.HH.
  });
  it("texto", () => {
    expect(C.textoCelebracion({ tipo: "cumple", nombre: "Ana Gómez", anios: null })).toBe("Ana Gómez cumple años");
    expect(C.textoCelebracion({ tipo: "aniversario", nombre: "Luis Paz", anios: 1 })).toBe("Luis Paz cumple 1 año en la empresa");
  });
});

describe("reconocimientos", () => {
  const valores = C.VALORES_INICIALES;
  const ok = { paraId: "b", valor: "Seguridad", mensaje: "Frenó la línea cuando vio la guarda floja." };
  it("los valores iniciales son válidos", () => {
    expect(C.limpiarValores(valores)).toEqual({ valores, error: null });
  });
  it("valida los valores", () => {
    expect(C.limpiarValores([]).error).toMatch(/al menos un valor/);
    expect(C.limpiarValores([{ nombre: "ab" }]).error).toMatch(/nombre/);
    expect(C.limpiarValores([{ nombre: "Calidad" }, { nombre: "calidad" }]).error).toMatch(/repetido/);
    expect(C.limpiarValores([{ nombre: "Calidad", emoji: "" }]).valores[0].emoji).toBe("⭐");
    expect(C.limpiarValores(Array.from({ length: 13 }, (_, i) => ({ nombre: `Valor ${i}` }))).error).toMatch(/Hasta 12/);
  });
  it("pide destinatario, valor de la lista y un ejemplo concreto", () => {
    expect(C.validarReconocimiento(ok, "a", valores, 0)).toMatchObject({ error: null, datos: { valor: { nombre: "Seguridad", emoji: "🦺" } } });
    expect(C.validarReconocimiento({ ...ok, paraId: "" }, "a", valores, 0).error).toMatch(/a quién/);
    expect(C.validarReconocimiento({ ...ok, paraId: "a" }, "a", valores, 0).error).toMatch(/vos mismo/);
    expect(C.validarReconocimiento({ ...ok, valor: "Inventado" }, "a", valores, 0).error).toMatch(/qué valor/);
    expect(C.validarReconocimiento({ ...ok, mensaje: "Genio" }, "a", valores, 0).error).toMatch(/ejemplo concreto/);
  });
  it("tope mensual para empleados; RR.HH. no tiene", () => {
    expect(C.validarReconocimiento(ok, "a", valores, 5).error).toMatch(/Ya diste 5/);
    expect(C.validarReconocimiento(ok, "a", valores, 4).error).toBeNull();
    expect(C.validarReconocimiento(ok, null, valores, null).error).toBeNull();
  });
  it("resumen: por valor, más reconocidos y alcance; los ocultos no cuentan", () => {
    const r = (legajoId, emisorId, valor, oculto = false) => ({ legajoId, emisorId, valor, oculto });
    const res = C.resumenReconocimientos([r("a", "b", "Seguridad"), r("a", "c", "Calidad"), r("b", "a", "Seguridad"), r("c", null, "Seguridad"), r("d", "a", "Calidad", true)], 10);
    expect(res).toMatchObject({ total: 4, reconocidos: 3, emisores: 3, alcance: 30 });
    expect(res.porValor).toEqual([{ clave: "Seguridad", cantidad: 3 }, { clave: "Calidad", cantidad: 1 }]);
    expect(res.masReconocidos[0]).toEqual({ clave: "a", cantidad: 2 });
    expect(C.resumenReconocimientos([], 0).alcance).toBeNull();
  });
});
