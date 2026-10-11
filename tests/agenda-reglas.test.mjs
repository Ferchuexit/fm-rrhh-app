// La agenda (lib/agenda-reglas.ts), el organigrama por personas y las
// publicaciones del muro.
import { describe, it, expect } from "vitest";
import * as A from "../lib/agenda-reglas.ts";
import { arbolPersonas } from "../lib/organigrama-reglas.ts";
import * as M from "../lib/muro-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const item = (clave, tipo, fecha, extra = {}) => ({ clave, tipo, fecha: d(fecha), hasta: null, hora: null, titulo: clave, detalle: null, url: null, ...extra });

describe("agenda: meses", () => {
  it("rango del mes, y el de hoy si viene mal", () => {
    expect(A.rangoDelMes("2026-02", d("2026-10-11"))).toEqual({ desde: d("2026-02-01"), hasta: d("2026-02-28"), mes: "2026-02" });
    expect(A.rangoDelMes("2028-02", d("2026-10-11")).hasta).toEqual(d("2028-02-29"));
    for (const mal of ["2026-13", "octubre", null, undefined, 5]) expect(A.rangoDelMes(mal, d("2026-10-11")).mes).toBe("2026-10");
  });
  it("mes anterior y siguiente cruzan el año", () => {
    expect(A.mesVecino("2026-12", 1)).toBe("2027-01");
    expect(A.mesVecino("2026-01", -1)).toBe("2025-12");
  });
  it("la grilla va de lunes a domingo y cubre el mes entero", () => {
    const g = A.grillaDelMes(d("2026-10-01"), d("2026-10-31")); // el 1 cae jueves
    expect(A.isoDia(g[0][0])).toBe("2026-09-28");
    expect(g.every((s) => s.length === 7 && s[0].getUTCDay() === 1)).toBe(true);
    expect(A.isoDia(g[g.length - 1][6])).toBe("2026-11-01");
    expect(g.length).toBe(5);
    // Un mes que arranca lunes no agrega una semana vacía adelante.
    expect(A.isoDia(A.grillaDelMes(d("2027-02-01"), d("2027-02-28"))[0][0])).toBe("2027-02-01");
  });
});

describe("agenda: qué hay cada día", () => {
  it("lo de varios días aparece en todos, recortado al rango", () => {
    const dias = A.porDia([item("vac", "vacaciones", "2026-10-29", { hasta: d("2026-11-03") }), item("ev", "evento", "2026-10-30", { hora: "18:00" })], d("2026-10-01"), d("2026-10-31"));
    expect([...dias.keys()]).toEqual(["2026-10-29", "2026-10-30", "2026-10-31"]);
    expect(dias.get("2026-10-30").map((i) => i.clave)).toEqual(["vac", "ev"]); // todo el día primero, después por hora
  });
  it("lo que empezó antes del rango se ve desde el primer día", () => {
    const i = item("vac", "vacaciones", "2026-09-25", { hasta: d("2026-10-02") });
    expect(A.tocaElRango(i, d("2026-10-01"), d("2026-10-31"))).toBe(true);
    expect([...A.porDia([i], d("2026-10-01"), d("2026-10-31")).keys()]).toEqual(["2026-10-01", "2026-10-02"]);
    expect(A.tocaElRango(item("x", "evento", "2026-09-30"), d("2026-10-01"), d("2026-10-31"))).toBe(false);
  });
  it("cuenta cuánta gente está afuera", () => {
    const afuera = A.ausentesPorDia([item("a", "vacaciones", "2026-10-05", { hasta: d("2026-10-06") }), item("b", "permiso", "2026-10-06"), item("c", "evento", "2026-10-06")], d("2026-10-01"), d("2026-10-31"));
    expect([...afuera]).toEqual([["2026-10-05", 1], ["2026-10-06", 2]]);
  });
});

describe("agenda: festejos", () => {
  const p = (id, nac, ing, extra = {}) => ({ id, nombre: id, apellido: "X", sector: "Taller", jefeId: null, fechaNacimiento: nac ? d(nac) : null, fechaIngreso: d(ing), ocultarCumple: false, ...extra });
  it("cumpleaños sin edad, aniversario con los años, y no el día que entra", () => {
    const f = A.festejosEnRango([p("ana", "1990-10-11", "2021-10-20"), p("nuevo", null, "2026-10-05")], d("2026-10-01"), d("2026-10-31"), true);
    expect(f.map((i) => [i.tipo, isNaN(i.fecha) ? "" : A.isoDia(i.fecha), i.titulo])).toEqual([["cumple", "2026-10-11", "Cumpleaños de ana X"], ["aniversario", "2026-10-20", "ana X: 5 años en la empresa"]]);
    expect(f[1].detalle).toBe("Aniversario redondo");
  });
  it("respeta a quien no quiere mostrar su cumpleaños (RR.HH. lo ve igual)", () => {
    const gente = [p("eva", "1990-10-11", "2026-01-01", { ocultarCumple: true })];
    expect(A.festejosEnRango(gente, d("2026-10-01"), d("2026-10-31"), true)).toEqual([]);
    expect(A.festejosEnRango(gente, d("2026-10-01"), d("2026-10-31"), false).length).toBe(1);
  });
  it("un rango que cruza de año", () => {
    const f = A.festejosEnRango([p("ana", "1990-01-03", "2020-12-28")], d("2026-12-20"), d("2027-01-10"), true);
    expect(f.map((i) => A.isoDia(i.fecha)).sort()).toEqual(["2026-12-28", "2027-01-03"]);
  });
});

describe("organigrama por personas", () => {
  const per = (id, jefeId = null) => ({ id, nombre: id, jefeId });
  it("cada uno debajo de su jefe, con cuántos tiene a cargo", () => {
    const { arbol, sueltos } = arbolPersonas([per("dueño"), per("jefe", "dueño"), per("op2", "jefe"), per("op1", "jefe"), per("solo")]);
    expect(arbol.map((f) => [f.persona.id, f.nivel, f.aCargo])).toEqual([["dueño", 0, 3], ["jefe", 1, 2], ["op1", 2, 0], ["op2", 2, 0]]);
    expect(sueltos.map((s) => s.id)).toEqual(["solo"]);
  });
  it("un jefe que ya no está no hace desaparecer a su gente, y un círculo no cuelga", () => {
    expect(arbolPersonas([per("a", "fantasma")]).sueltos.map((s) => s.id)).toEqual(["a"]);
    const { arbol, sueltos } = arbolPersonas([per("a", "b"), per("b", "a")]);
    expect([...arbol.map((f) => f.persona.id), ...sueltos.map((s) => s.id)].sort()).toEqual(["a", "b"]);
    expect(arbolPersonas([per("yo", "yo")]).sueltos.length).toBe(1);
  });
});

describe("publicaciones del muro", () => {
  it("pide texto o foto, y hay un tope por día (no para RR.HH.)", () => {
    expect(M.validarPublicacion("  ", false, 0).error).toMatch(/algo o sumá una foto/);
    expect(M.validarPublicacion("", true, 0).error).toBeNull();
    expect(M.validarPublicacion(" Terminamos! ", false, 0)).toEqual({ texto: "Terminamos!", error: null });
    expect(M.validarPublicacion("hola a todos", false, M.MAX_PUBLICACIONES_POR_DIA).error).toMatch(/Mañana/);
    expect(M.validarPublicacion("hola a todos", false, null).error).toBeNull();
    expect(M.validarPublicacion("x".repeat(3000), false, 0).texto.length).toBe(M.MAX_TEXTO_PUBLICACION);
  });
  it("la foto se juzga por lo que es", () => {
    expect(M.motivoFotoInvalida(1000, "image/jpeg")).toBeNull();
    expect(M.motivoFotoInvalida(1000, "application/pdf")).toMatch(/foto/);
    expect(M.motivoFotoInvalida(1000, null)).toMatch(/foto/);
    expect(M.motivoFotoInvalida(M.MAX_FOTO_BYTES + 1, "image/png")).toMatch(/4 MB/);
  });
  it("lo pendiente lo ve solo su autor; lo oculto, nadie", () => {
    expect(M.visibleEnMuro({ oculto: false, pendiente: true, autorId: "ana" }, "ana")).toBe(true);
    expect(M.visibleEnMuro({ oculto: false, pendiente: true, autorId: "ana" }, "luis")).toBe(false);
    expect(M.visibleEnMuro({ oculto: true, pendiente: false, autorId: "ana" }, "ana")).toBe(false);
    expect(M.visibleEnMuro({ oculto: false, pendiente: false, autorId: null }, "luis")).toBe(true);
  });
  it("mezcla reconocimientos y publicaciones, lo más nuevo arriba", () => {
    const m = M.mezclar([{ id: "r1", createdAt: d("2026-10-10") }], [{ id: "p1", createdAt: d("2026-10-11") }, { id: "p0", createdAt: d("2026-10-01") }], 2);
    expect(m.map((x) => [x.tipo, x.item.id])).toEqual([["publicacion", "p1"], ["reconocimiento", "r1"]]);
    expect(M.limpiarComentario("  ")).toBeNull();
  });
});
