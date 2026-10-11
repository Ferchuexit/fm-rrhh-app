// EPP y ropa de trabajo (lib/epp-reglas.ts).
import { describe, it, expect } from "vitest";
import * as E from "../lib/epp-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const hoy = d("2026-10-11");
const el = (id, extra = {}) => ({ id, activo: true, paraTodos: false, centroCostoIds: [], puestoIds: [], ...extra });
const ent = (elementoId, fecha, vence = null, firmada = true) => ({ elementoId, fechaEntrega: d(fecha), vence: vence ? d(vence) : null, firmada });

describe("catálogo", () => {
  it("valida y limpia", () => {
    expect(E.validarElemento({ nombre: "ab" }).error).toMatch(/nombre/);
    expect(E.validarElemento({ nombre: "Guantes", vidaUtilDias: "0" }).error).toMatch(/vida útil/);
    expect(E.validarElemento({ nombre: "Guantes", vidaUtilDias: "60,5" }).error).toMatch(/vida útil/);
    expect(E.validarElemento({ nombre: " Guantes ", vidaUtilDias: "60", marca: " 3M ", centroCostoIds: ["t", "t"], puestoIds: ["p"], talle: "raro" }).datos).toEqual({ nombre: "Guantes", tipoModelo: null, marca: "3M", certificado: true, vidaUtilDias: 60, talle: null, paraTodos: false, centroCostoIds: ["t"], puestoIds: ["p"] });
    expect(E.validarElemento({ nombre: "Faja lumbar", vidaUtilDias: "" }).datos.vidaUtilDias).toBeNull();
    // Si es para todos, los sectores y puestos sobran.
    expect(E.validarElemento({ nombre: "Calzado", paraTodos: true, centroCostoIds: ["t"], puestoIds: ["p"], talle: "calzado", certificado: false }).datos).toMatchObject({ paraTodos: true, centroCostoIds: [], puestoIds: [], talle: "calzado", certificado: false });
  });
  it("a quién le corresponde: a todos, por sector o por puesto", () => {
    const p = { centroCostoId: "taller", puestoId: "soldador" };
    expect(E.leCorresponde(el("a", { paraTodos: true }), p)).toBe(true);
    expect(E.leCorresponde(el("a", { centroCostoIds: ["taller"] }), p)).toBe(true);
    expect(E.leCorresponde(el("a", { puestoIds: ["soldador"] }), p)).toBe(true);
    expect(E.leCorresponde(el("a", { centroCostoIds: ["ventas"], puestoIds: ["chofer"] }), p)).toBe(false);
    expect(E.leCorresponde(el("a"), p)).toBe(false); // sin nadie asignado
    expect(E.leCorresponde(el("a", { paraTodos: true, activo: false }), p)).toBe(false);
    expect(E.leCorresponde(el("a", { centroCostoIds: ["taller"] }), { centroCostoId: null, puestoId: null })).toBe(false);
  });
});

describe("entregas", () => {
  it("vencimiento = entrega + vida útil", () => {
    expect(E.vencimiento(d("2026-01-01"), 30)).toEqual(d("2026-01-31"));
    expect(E.vencimiento(d("2026-01-01"), null)).toBeNull();
  });
  it("valida la entrega", () => {
    const ok = { elementoId: "x", cantidad: 2, motivo: "rotura", talle: " 42 " };
    expect(E.validarEntrega(ok, hoy, hoy).datos).toMatchObject({ elementoId: "x", cantidad: 2, motivo: "rotura", talle: "42" });
    expect(E.validarEntrega({ ...ok, elementoId: "" }, hoy, hoy).error).toMatch(/qué se entrega/);
    expect(E.validarEntrega({ ...ok, cantidad: 0 }, hoy, hoy).error).toMatch(/cantidad/);
    expect(E.validarEntrega(ok, null, hoy).error).toMatch(/fecha/);
    expect(E.validarEntrega(ok, d("2026-10-12"), hoy).error).toMatch(/futuro/);
    expect(E.validarEntrega(ok, d("2016-10-11"), hoy).error).toMatch(/5 años/);
    expect(E.validarEntrega({ ...ok, motivo: "inventado" }, hoy, hoy).datos.motivo).toBe("reposicion");
  });
});

describe("estado del EPP de una persona", () => {
  it("manda la última entrega", () => {
    expect(E.estadoElemento([], hoy).estado).toBe("falta");
    expect(E.estadoElemento([ent("a", "2026-01-01", "2026-07-01")], hoy).estado).toBe("vencido");
    // La vieja venció, pero ya se repuso.
    expect(E.estadoElemento([ent("a", "2026-01-01", "2026-07-01"), ent("a", "2026-09-01", "2027-03-01")], hoy).estado).toBe("vigente");
    expect(E.estadoElemento([ent("a", "2026-05-01", "2026-11-01")], hoy).estado).toBe("por_vencer");
    expect(E.estadoElemento([ent("a", "2026-05-01", "2026-11-10")], hoy).estado).toBe("por_vencer"); // justo a 30 días
    expect(E.estadoElemento([ent("a", "2026-05-01", "2026-11-11")], hoy).estado).toBe("vigente");
    expect(E.estadoElemento([ent("a", "2020-01-01", null)], hoy).estado).toBe("vigente"); // no vence
    expect(E.estadoElemento([ent("a", "2026-10-01", "2027-10-01", false)], hoy).estado).toBe("sin_firmar");
    // El día que vence todavía sirve.
    expect(E.estadoElemento([ent("a", "2026-04-14", "2026-10-11")], hoy).estado).toBe("por_vencer");
  });
  it("lo vencido pesa más que la firma", () => {
    expect(E.estadoElemento([ent("a", "2026-01-01", "2026-07-01", false)], hoy).estado).toBe("vencido");
  });
  it("arma lo que le corresponde a cada uno", () => {
    const elementos = [el("calzado", { paraTodos: true }), el("guantes", { centroCostoIds: ["taller"] }), el("arnes", { puestoIds: ["techista"] })];
    const filas = E.eppDe({ centroCostoId: "taller", puestoId: null }, elementos, [ent("calzado", "2026-06-01", "2027-06-01"), ent("arnes", "2026-06-01")], hoy);
    expect(filas.map((f) => [f.elementoId, f.estado])).toEqual([["calzado", "vigente"], ["guantes", "falta"]]);
    expect(E.estaProtegido(filas)).toBe(false);
  });
  it("por vencer y sin firma todavía protegen, pero no es 'completo'", () => {
    const filas = [{ elementoId: "a", estado: "por_vencer", ultima: null }, { elementoId: "b", estado: "sin_firmar", ultima: null }];
    expect(E.estaProtegido(filas)).toBe(true);
    expect(E.estaCompleto(filas)).toBe(false);
  });
});

describe("resumen", () => {
  const f = (estado) => ({ elementoId: "x", estado, ultima: null });
  it("cuenta personas protegidas y elementos por estado", () => {
    const r = E.resumenEpp([{ id: "a", filas: [f("vigente"), f("vigente")] }, { id: "b", filas: [f("vigente"), f("vencido")] }, { id: "c", filas: [f("falta"), f("por_vencer"), f("sin_firmar")] }, { id: "d", filas: [] }]);
    expect(r).toMatchObject({ personas: 3, sinAsignar: 1, protegidas: 1, pctProtegidas: 33.3, completas: 1, elementos: 7, falta: 1, vencido: 1, porVencer: 1, sinFirmar: 1, vigente: 3, pctEntregado: 71.4 });
  });
  it("sin nadie con EPP asignado no hay porcentaje", () => {
    expect(E.resumenEpp([{ id: "a", filas: [] }])).toMatchObject({ personas: 0, pctProtegidas: null, pctEntregado: null });
  });
});
