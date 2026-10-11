// Eventos de la empresa (lib/eventos-reglas.ts).
import { describe, it, expect } from "vitest";
import * as E from "../lib/eventos-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const hoy = d("2026-10-11");
const base = { titulo: "Asado de fin de año", fecha: "2026-12-12", hora: "20:30" };
const ev = (extra = {}) => ({ estado: "publicado", fecha: d("2026-12-12"), pideConfirmacion: true, limiteConfirmar: null, cupo: null, maxAcompanantes: 0, ...extra });

describe("validar un evento", () => {
  it("acepta lo mínimo y limpia", () => {
    const { datos, error } = E.validarEvento({ ...base, titulo: "  Asado  ", centroCostoIds: ["a", "a", "b"] }, hoy);
    expect(error).toBeNull();
    expect(datos).toMatchObject({ titulo: "Asado", hora: "20:30", pideConfirmacion: true, cupo: null, maxAcompanantes: 0, centroCostoIds: ["a", "b"], limiteConfirmar: null });
    expect(datos.fecha).toEqual(d("2026-12-12"));
  });
  it("rechaza sin nombre, sin fecha, fecha pasada u hora rara", () => {
    expect(E.validarEvento({ ...base, titulo: "a" }, hoy).error).toMatch(/nombre/);
    expect(E.validarEvento({ ...base, fecha: "" }, hoy).error).toMatch(/qué día/);
    expect(E.validarEvento({ ...base, fecha: "2026-10-10" }, hoy).error).toMatch(/ya pasó/);
    expect(E.validarEvento({ ...base, hora: "25:00" }, hoy).error).toMatch(/18:30/);
    expect(E.validarEvento({ ...base, fecha: "2026-10-11" }, hoy).error).toBeNull(); // hoy vale
  });
  it("la fecha límite va entre hoy y el evento", () => {
    expect(E.validarEvento({ ...base, limiteConfirmar: "2026-12-13" }, hoy).error).toMatch(/después del evento/);
    expect(E.validarEvento({ ...base, limiteConfirmar: "2026-10-01" }, hoy).error).toMatch(/ya pasó/);
    expect(E.validarEvento({ ...base, limiteConfirmar: "2026-12-05" }, hoy).datos.limiteConfirmar).toEqual(d("2026-12-05"));
  });
  it("cupo y acompañantes", () => {
    expect(E.validarEvento({ ...base, cupo: "0" }, hoy).error).toMatch(/cupo/);
    expect(E.validarEvento({ ...base, cupo: "2.5" }, hoy).error).toMatch(/cupo/);
    expect(E.validarEvento({ ...base, cupo: "" }, hoy).datos.cupo).toBeNull();
    expect(E.validarEvento({ ...base, cupo: "80", maxAcompanantes: "2" }, hoy).datos).toMatchObject({ cupo: 80, maxAcompanantes: 2 });
    expect(E.validarEvento({ ...base, maxAcompanantes: 11 }, hoy).error).toMatch(/acompañantes/);
  });
  it("si es solo un anuncio, no guarda cupo ni límite ni acompañantes", () => {
    expect(E.validarEvento({ ...base, pideConfirmacion: false, cupo: 10, maxAcompanantes: 3, limiteConfirmar: "2026-12-01" }, hoy).datos).toMatchObject({ pideConfirmacion: false, cupo: null, maxAcompanantes: 0, limiteConfirmar: null });
  });
});

describe("a quién le corresponde", () => {
  it("vacío = todos; si no, solo esos sectores", () => {
    expect(E.leCorresponde({ centroCostoIds: [] }, null)).toBe(true);
    expect(E.leCorresponde({ centroCostoIds: ["t"] }, "t")).toBe(true);
    expect(E.leCorresponde({ centroCostoIds: ["t"] }, "x")).toBe(false);
    expect(E.leCorresponde({ centroCostoIds: ["t"] }, null)).toBe(false);
  });
});

describe("responder", () => {
  it("cuándo no se puede", () => {
    expect(E.motivoNoResponder(ev(), hoy)).toBeNull();
    expect(E.motivoNoResponder(ev({ estado: "cancelado" }), hoy)).toMatch(/canceló/);
    expect(E.motivoNoResponder(ev({ estado: "borrador" }), hoy)).toMatch(/publicado/);
    expect(E.motivoNoResponder(ev({ pideConfirmacion: false }), hoy)).toMatch(/no necesita/);
    expect(E.motivoNoResponder(ev({ fecha: d("2026-10-10") }), hoy)).toMatch(/ya pasó/);
    expect(E.motivoNoResponder(ev({ limiteConfirmar: d("2026-10-10") }), hoy)).toMatch(/fecha para confirmar/);
    expect(E.motivoNoResponder(ev({ limiteConfirmar: d("2026-10-11") }), hoy)).toBeNull(); // el último día vale
    expect(E.motivoNoResponder(ev({ fecha: d("2026-10-11") }), hoy)).toBeNull(); // el mismo día vale
  });
  it("va / no va, y los acompañantes", () => {
    expect(E.validarRespuesta({}, ev(), [], hoy).error).toMatch(/si vas o no/);
    expect(E.validarRespuesta({ va: true }, ev(), [], hoy).respuesta).toEqual({ va: true, acompanantes: 0 });
    expect(E.validarRespuesta({ va: true, acompanantes: 1 }, ev(), [], hoy).error).toMatch(/sin acompañantes/);
    expect(E.validarRespuesta({ va: true, acompanantes: 3 }, ev({ maxAcompanantes: 2 }), [], hoy).error).toMatch(/hasta 2/);
    expect(E.validarRespuesta({ va: true, acompanantes: 2 }, ev({ maxAcompanantes: 2 }), [], hoy).respuesta).toEqual({ va: true, acompanantes: 2 });
    // Quien no va no lleva a nadie, diga lo que diga.
    expect(E.validarRespuesta({ va: false, acompanantes: 2 }, ev({ maxAcompanantes: 2 }), [], hoy).respuesta).toEqual({ va: false, acompanantes: 0 });
  });
  it("el cupo cuenta a los acompañantes, y decir que no siempre se puede", () => {
    const e = ev({ cupo: 4, maxAcompanantes: 2 });
    const otras = [{ va: true, acompanantes: 1 }, { va: false, acompanantes: 0 }, { va: true, acompanantes: 0 }]; // 3 ocupados
    expect(E.lugaresOcupados(otras)).toBe(3);
    expect(E.validarRespuesta({ va: true, acompanantes: 0 }, e, otras, hoy).error).toBeNull();
    expect(E.validarRespuesta({ va: true, acompanantes: 1 }, e, otras, hoy).error).toMatch(/queda 1 lugar/);
    expect(E.validarRespuesta({ va: true }, e, [...otras, { va: true, acompanantes: 0 }], hoy).error).toMatch(/no quedan lugares/i);
    expect(E.validarRespuesta({ va: false }, e, [...otras, { va: true, acompanantes: 0 }], hoy).error).toBeNull();
  });
});

describe("resumen", () => {
  it("cuenta con cuántos contar", () => {
    const r = E.resumenEvento([{ va: true, acompanantes: 2 }, { va: true, acompanantes: 0 }, { va: false, acompanantes: 0 }], 10, 20);
    expect(r).toEqual({ van: 2, noVan: 1, acompanantes: 2, total: 4, sinResponder: 7, quedan: 16, asistieron: null });
  });
  it("asistencia: solo si se tomó", () => {
    expect(E.resumenEvento([{ va: true, acompanantes: 0, asistio: true }, { va: true, acompanantes: 0, asistio: false }, { va: true, acompanantes: 0, asistio: null }], 3, null)).toMatchObject({ asistieron: 1, quedan: null, sinResponder: 0 });
  });
  it("cuándo es", () => {
    expect(E.cuandoEs({ fecha: d("2026-12-12"), hora: "20:30" })).toBe("sábado, 12 de diciembre, 20:30 hs");
  });
});
