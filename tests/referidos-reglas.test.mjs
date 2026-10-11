// Programa de referidos (lib/referidos-reglas.ts).
import { describe, it, expect } from "vitest";
import * as R from "../lib/referidos-reglas.ts";

const ok = { nombre: "Marta", apellido: "Sosa", telefono: "3492 555123", relacion: "trabajo", mensaje: "Trabajamos 4 años en la misma línea, muy prolija.", consentimiento: "on" };

describe("recomendar a alguien", () => {
  it("acepta una recomendación completa", () => {
    const { referido, error } = R.validarReferido(ok, 0);
    expect(error).toBeNull();
    expect(referido).toMatchObject({ relacion: "trabajo", datos: { nombre: "Marta", apellido: "Sosa", telefono: "3492 555123", email: null } });
  });
  it("pide nombre, un contacto, de dónde la conoce y por qué", () => {
    expect(R.validarReferido({ ...ok, nombre: "" }, 0).error).toMatch(/de la persona/);
    expect(R.validarReferido({ ...ok, telefono: "" }, 0).error).toMatch(/teléfono o un mail/);
    expect(R.validarReferido({ ...ok, telefono: "", email: "marta@correo.com" }, 0).error).toBeNull();
    expect(R.validarReferido({ ...ok, email: "marta@" }, 0).error).toMatch(/mail/);
    expect(R.validarReferido({ ...ok, relacion: "vecino" }, 0).error).toMatch(/de dónde/);
    expect(R.validarReferido({ ...ok, mensaje: "es buena" }, 0).error).toMatch(/por qué/);
  });
  it("no pasa datos de un tercero sin su acuerdo", () => {
    expect(R.validarReferido({ ...ok, consentimiento: undefined }, 0).error).toMatch(/de acuerdo/);
  });
  it("tope por búsqueda", () => {
    expect(R.validarReferido(ok, R.MAX_REFERIDOS_POR_BUSQUEDA - 1).error).toBeNull();
    expect(R.validarReferido(ok, R.MAX_REFERIDOS_POR_BUSQUEDA).error).toMatch(/máximo/);
  });
});

describe("lo que ve quien recomendó", () => {
  it("resume las etapas sin el detalle interno", () => {
    expect(R.estadoParaReferidor("postulado").clave).toBe("recibido");
    for (const e of ["preseleccion", "entrevista", "preocupacional", "oferta"]) expect(R.estadoParaReferidor(e).clave).toBe("proceso");
    expect(R.estadoParaReferidor("contratado").clave).toBe("ingreso");
    expect(R.estadoParaReferidor("descartado")).toEqual({ clave: "no", texto: "No avanzó esta vez" });
  });
});

describe("resumen del programa", () => {
  const f = (por, etapa, extra = {}) => ({ referidoPorId: por, etapa, premioReferidoEn: null, conPremio: true, ...extra });
  it("cuenta, calcula la efectividad y los premios pendientes", () => {
    const r = R.resumenReferidos([f("ana", "contratado"), f("ana", "descartado"), f("luis", "entrevista"), f("luis", "contratado", { premioReferidoEn: new Date() }), f("eva", "contratado", { conPremio: false }), f("ana", "postulado")]);
    expect(r).toMatchObject({ total: 6, contratados: 3, enProceso: 2, efectividad: 50, premiosPendientes: 1 });
    expect(r.quienes).toEqual([{ clave: "ana", referidos: 3, contratados: 1 }, { clave: "luis", referidos: 2, contratados: 1 }, { clave: "eva", referidos: 1, contratados: 1 }]);
  });
  it("vacío", () => {
    expect(R.resumenReferidos([])).toMatchObject({ total: 0, efectividad: null, premiosPendientes: 0, quienes: [] });
  });
});
