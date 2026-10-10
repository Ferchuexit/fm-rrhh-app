// Noticias — destinatarios, estado de lectura y estadísticas (lib/noticias-reglas.ts).
import { describe, it, expect } from "vitest";
import { validarNoticia, esDestinatario, estadoLectura, estadisticas, resumenCuerpo, MAX_CUERPO } from "../lib/noticias-reglas.ts";

describe("A quién le llega una noticia", () => {
  const taller = { empresaId: "moras", centroCostoId: "taller" };
  const n = (extra = {}) => ({ empresaId: "moras", estado: "publicada", centroCostoId: null, ...extra });

  it("toda la empresa: le llega a todos, tengan sector o no", () => {
    expect(esDestinatario(n(), taller)).toBe(true);
    expect(esDestinatario(n(), { empresaId: "moras", centroCostoId: null })).toBe(true);
  });

  it("por sector: solo a ese sector", () => {
    expect(esDestinatario(n({ centroCostoId: "taller" }), taller)).toBe(true);
    expect(esDestinatario(n({ centroCostoId: "ventas" }), taller)).toBe(false);
    expect(esDestinatario(n({ centroCostoId: "taller" }), { empresaId: "moras", centroCostoId: null })).toBe(false); // sin sector asignado no recibe las de sector
  });

  it("nunca cruza de empresa, aunque el sector se llame igual", () => {
    expect(esDestinatario(n(), { empresaId: "otra", centroCostoId: "taller" })).toBe(false);
    expect(esDestinatario(n({ centroCostoId: "taller" }), { empresaId: "otra", centroCostoId: "taller" })).toBe(false);
  });

  it("archivada no le llega a nadie", () => {
    expect(esDestinatario(n({ estado: "archivada" }), taller)).toBe(false);
  });
});

describe("Qué le falta hacer al empleado", () => {
  it("sin abrir = nueva", () => {
    expect(estadoLectura(false, null)).toBe("nueva");
    expect(estadoLectura(true, undefined)).toBe("nueva");
  });
  it("abierta sin pedir acuse = al día", () => expect(estadoLectura(false, { acuseEn: null })).toBe("al_dia"));
  it("abierta pero falta el acuse = sigue pendiente", () => expect(estadoLectura(true, { acuseEn: null })).toBe("falta_acuse"));
  it("con acuse = al día", () => expect(estadoLectura(true, { acuseEn: new Date() })).toBe("al_dia"));
});

describe("Estadísticas para RR.HH.", () => {
  it("cuenta leídas y confirmadas sobre los destinatarios", () => {
    const e = estadisticas(["a", "b", "c", "d"], [{ legajoId: "a", acuseEn: "2026-10-09" }, { legajoId: "b", acuseEn: null }]);
    expect(e).toEqual({ destinatarios: 4, leyeron: 2, acusaron: 1 });
  });

  it("no cuenta la lectura de quien ya no es destinatario (se fue o cambió de sector)", () => {
    const e = estadisticas(["a", "b"], [{ legajoId: "a", acuseEn: null }, { legajoId: "ex-empleado", acuseEn: "2026-10-01" }]);
    expect(e).toEqual({ destinatarios: 2, leyeron: 1, acusaron: 0 });
  });

  it("sin destinatarios no rompe", () => expect(estadisticas([], [])).toEqual({ destinatarios: 0, leyeron: 0, acusaron: 0 }));
});

describe("Validación y resumen", () => {
  it("exige título y texto, con tope de largo", () => {
    expect(validarNoticia("Corte de luz", "El sábado no hay actividad en planta.")).toBeNull();
    expect(validarNoticia("", "El sábado no hay actividad en planta.")).toMatch(/título/);
    expect(validarNoticia("Corte de luz", "corto")).toMatch(/texto/);
    expect(validarNoticia("x".repeat(121), "El sábado no hay actividad.")).toMatch(/título/);
    expect(validarNoticia("Corte de luz", "x".repeat(MAX_CUERPO + 1))).toMatch(/PDF/);
    expect(validarNoticia(null, undefined)).not.toBeNull();
  });

  it("el resumen corta en una palabra entera y aplana los saltos de línea", () => {
    expect(resumenCuerpo("Hola\n\nmundo")).toBe("Hola mundo");
    const r = resumenCuerpo("palabra ".repeat(40), 50);
    expect(r.length).toBeLessThanOrEqual(51);
    expect(r.endsWith("palabra…")).toBe(true);
  });
});
