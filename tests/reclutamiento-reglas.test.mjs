// Puestos y reclutamiento (lib/reclutamiento-reglas.ts).
import { describe, it, expect } from "vitest";
import * as R from "../lib/reclutamiento-reglas.ts";

describe("puestos y organigrama", () => {
  it("valida nombre y dotación", () => {
    expect(R.validarPuesto({ nombre: "ab" }).error).toMatch(/nombre/);
    expect(R.validarPuesto({ nombre: "Operario", dotacion: -1 }).error).toMatch(/dotación/);
    expect(R.validarPuesto({ nombre: " Operario de seccionadora ", tareas: "Cortar\r\nMedir", dotacion: "3" })).toMatchObject({ error: null, datos: { nombre: "Operario de seccionadora", tareas: "Cortar\nMedir", dotacion: 3, reportaAId: null } });
  });
  it("detecta dependencias en círculo", () => {
    const dep = new Map([["gerente", null], ["jefe", "gerente"], ["operario", "jefe"]]);
    expect(R.armaCirculo("gerente", "operario", dep)).toBe(true); // el gerente dependería de su operario
    expect(R.armaCirculo("jefe", "jefe", dep)).toBe(true);
    expect(R.armaCirculo("operario", "gerente", dep)).toBe(false);
    expect(R.armaCirculo(null, "operario", dep)).toBe(false); // puesto nuevo
  });
  it("arma el árbol con niveles, vacantes y gente a cargo", () => {
    const p = (id, reportaAId, dotacion, ocupantes) => ({ id, nombre: id, reportaAId, dotacion, ocupantes });
    const filas = R.organigrama([p("operario", "jefe", 6, 4), p("gerente", null, 1, 1), p("jefe", "gerente", 1, 1), p("administrativo", "gerente", 2, 3), p("huérfano", "borrado", 1, 0)]);
    expect(filas.map((f) => [f.puesto.id, f.nivel, f.vacantes, f.aCargo])).toEqual([
      ["gerente", 0, 0, 8], ["administrativo", 1, 0, 0], ["jefe", 1, 0, 4], ["operario", 2, 2, 0], ["huérfano", 0, 1, 0],
    ]);
  });
  it("no se cuelga si la base quedó con un círculo", () => {
    const filas = R.organigrama([{ id: "a", nombre: "a", reportaAId: "b", dotacion: 1, ocupantes: 1 }, { id: "b", nombre: "b", reportaAId: "a", dotacion: 1, ocupantes: 1 }]);
    expect(filas.map((f) => f.puesto.id).sort()).toEqual(["a", "b"]);
  });
});

describe("búsquedas", () => {
  const ok = { titulo: "Operario de seccionadora", descripcion: "Corte de tableros según orden de producción.", vacantes: 2 };
  it("valida el aviso", () => {
    expect(R.validarBusqueda(ok)).toMatchObject({ error: null, datos: { publica: true, interna: false, vacantes: 2 } });
    expect(R.validarBusqueda({ ...ok, titulo: "" }).error).toMatch(/título/);
    expect(R.validarBusqueda({ ...ok, descripcion: "Cortar" }).error).toMatch(/qué va a hacer/);
    expect(R.validarBusqueda({ ...ok, vacantes: 0 }).error).toMatch(/vacantes/);
    expect(R.validarBusqueda({ ...ok, publica: false }).error).toMatch(/cómo llegan los candidatos/);
    expect(R.validarBusqueda({ ...ok, publica: false, interna: true }).error).toBeNull();
    expect(R.validarBusqueda({ ...ok, publica: false, referidos: true, premioReferido: " Un día libre " }).datos).toMatchObject({ referidos: true, premioReferido: "Un día libre" });
    expect(R.validarBusqueda({ ...ok, premioReferido: "x" }).datos.premioReferido).toBeNull(); // sin referidos no hay premio
  });
  it("arma el aviso desde el perfil del puesto", () => {
    const a = R.avisoDesdePuesto({ nombre: "Operario de seccionadora", mision: "Cortar tableros a medida.", tareas: "- Cortar\n• Medir\n\nLimpiar el puesto", requisitos: "Secundario completo\nExperiencia en carpintería", condiciones: "Lunes a viernes de 6 a 14" }, "Taller");
    expect(a.titulo).toBe("Operario de seccionadora");
    expect(a.descripcion).toBe("Cortar tableros a medida.\n\nPrincipales tareas:\n• Cortar\n• Medir\n• Limpiar el puesto");
    expect(a.requisitos).toBe("• Secundario completo\n• Experiencia en carpintería");
    expect(a.ofrecemos).toBe("Lunes a viernes de 6 a 14");
    expect(R.avisoDesdePuesto({ nombre: "Chofer", mision: null, tareas: null, requisitos: null, condiciones: null }, "Logística").descripcion).toBe("Buscamos Chofer para el sector Logística.");
  });
  it("el texto para el portal lleva el enlace con la fuente", () => {
    const t = R.textoParaPortal({ ...ok, requisitos: "• Secundario", ofrecemos: null, lugar: "Benavídez" }, "Moras S.A.", "https://x/empleos/1?f=bumeran");
    expect(t.split("\n")[0]).toBe("OPERARIO DE SECCIONADORA — Benavídez");
    expect(t).toContain("REQUISITOS\n• Secundario");
    expect(t).not.toContain("OFRECEMOS");
    expect(t.endsWith("Postulate acá: https://x/empleos/1?f=bumeran")).toBe(true);
  });
  it("la fuente del enlace no se puede inventar", () => {
    expect(R.fuenteValida("bumeran")).toBe("bumeran");
    for (const f of ["interno", "manual", "<script>", undefined, 3]) expect(R.fuenteValida(f)).toBe("web");
  });
});

describe("postulación", () => {
  const base = { nombre: "Ana", apellido: "Gómez", email: " Ana@Mail.com ", consentimiento: true };
  it("de afuera pide contacto y consentimiento", () => {
    expect(R.validarPostulacion(base, true)).toMatchObject({ error: null, datos: { email: "ana@mail.com", telefono: null } });
    expect(R.validarPostulacion({ ...base, nombre: "A" }, true).error).toMatch(/nombre/);
    expect(R.validarPostulacion({ ...base, email: "ana@" }, true).error).toMatch(/mail/);
    expect(R.validarPostulacion({ ...base, email: "", telefono: "" }, true).error).toMatch(/mail o un teléfono/);
    expect(R.validarPostulacion({ ...base, email: "", telefono: "1234" }, true).error).toMatch(/teléfono/);
    expect(R.validarPostulacion({ ...base, email: "", telefono: "11 4444-5555" }, true).error).toBeNull();
    expect(R.validarPostulacion({ ...base, consentimiento: false }, true).error).toMatch(/aceptar/);
    expect(R.validarPostulacion({ ...base, consentimiento: "on" }, true).error).toBeNull(); // así llega de un formulario
  });
  it("cargada por RR.HH. no pide consentimiento ni contacto", () => {
    expect(R.validarPostulacion({ nombre: "Ana", apellido: "Gómez" }, false).error).toBeNull();
  });
});

describe("etapas", () => {
  it("descartar pide motivo; contratar, que queden vacantes", () => {
    expect(R.motivoNoMover("entrevista", null, 0, 1, false)).toBeNull();
    expect(R.motivoNoMover("cualquiera", null, 0, 1, false)).toMatch(/inválida/);
    expect(R.motivoNoMover("descartado", "", 0, 1, false)).toMatch(/por qué/);
    expect(R.motivoNoMover("descartado", "perfil", 0, 1, false)).toBeNull();
    expect(R.motivoNoMover("contratado", null, 1, 1, false)).toMatch(/ya está cubierta/);
    expect(R.motivoNoMover("contratado", null, 1, 2, false)).toBeNull();
    expect(R.motivoNoMover("contratado", null, 1, 1, true)).toBeNull(); // ya lo estaba
  });
  it("resumen: por etapa, por fuente y días abierta", () => {
    const c = (etapa, fuente) => ({ etapa, fuente });
    const r = R.resumenBusqueda({ abiertaEn: new Date("2026-10-01T15:00:00Z"), cerradaEn: null, vacantes: 1 }, [c("postulado", "bumeran"), c("postulado", "bumeran"), c("entrevista", "bumeran"), c("contratado", "referido"), c("descartado", "web")], new Date("2026-10-11T00:00:00Z"));
    expect(r).toMatchObject({ total: 5, enProceso: 3, sinRevisar: 2, cubiertas: 1, dias: 9 });
    expect(r.porEtapa).toMatchObject({ postulado: 2, entrevista: 1, contratado: 1, descartado: 1, oferta: 0 });
    expect(r.fuentes[0]).toEqual({ fuente: "bumeran", nombre: "Bumeran", total: 3, avanzaron: 1, contratados: 0 });
    expect(R.resumenBusqueda({ abiertaEn: null, cerradaEn: null, vacantes: 1 }, [], new Date()).dias).toBeNull();
  });
});
