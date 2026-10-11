// Chat interno y grupos (lib/chat-reglas.ts).
import { describe, it, expect } from "vitest";
import * as C from "../lib/chat-reglas.ts";

const d = (s) => new Date(s);
const conv = (extra = {}) => ({ tipo: "grupo", todos: false, centroCostoIds: [], soloAnuncios: false, empleadoId: null, clave: null, archivada: false, ...extra });
const ana = { id: "ana", centroCostoId: "taller" };
const luis = { id: "luis", centroCostoId: "ventas" };

describe("texto y claves", () => {
  it("limpia el mensaje", () => {
    expect(C.limpiarTexto("  hola \r\n")).toBe("hola");
    expect(C.limpiarTexto("   ")).toBeNull();
    expect(C.limpiarTexto(null)).toBeNull();
    expect(C.limpiarTexto(123)).toBeNull();
    expect(C.limpiarTexto("a\n\n\n\n\n\nb")).toBe("a\n\n\nb");
    expect(C.limpiarTexto("x".repeat(5000)).length).toBe(C.MAX_TEXTO);
  });
  it("la charla directa tiene la misma clave la abra quien la abra", () => {
    expect(C.claveDirecta("b", "a")).toBe(C.claveDirecta("a", "b"));
    expect(C.participantesDe(C.claveDirecta("b", "a"))).toEqual(["a", "b"]);
    expect(C.participantesDe(C.claveRRHH("a"))).toEqual([]);
  });
});

describe("grupos", () => {
  it("valida y limpia", () => {
    expect(C.validarGrupo({ nombre: "ab" }).error).toMatch(/nombre/);
    expect(C.validarGrupo({ nombre: " Taller ", centroCostoIds: ["t", "t"], soloAnuncios: true }).datos).toEqual({ nombre: "Taller", descripcion: null, emoji: "💬", todos: false, centroCostoIds: ["t"], soloAnuncios: true });
    // Si es de toda la empresa, los sectores sobran.
    expect(C.validarGrupo({ nombre: "Novedades", todos: true, centroCostoIds: ["t"], emoji: "📣" }).datos).toMatchObject({ todos: true, centroCostoIds: [], emoji: "📣" });
  });
  it("quién participa: toda la empresa, su sector, o agregado a mano", () => {
    expect(C.participa(conv({ todos: true }), ana, null)).toBe(true);
    expect(C.participa(conv({ centroCostoIds: ["taller"] }), ana, null)).toBe(true);
    expect(C.participa(conv({ centroCostoIds: ["taller"] }), luis, null)).toBe(false);
    expect(C.participa(conv({ centroCostoIds: ["taller"] }), luis, { agregado: true, admin: false })).toBe(true);
    // La fila que solo guarda "hasta dónde leyó" no lo hace miembro.
    expect(C.participa(conv({ centroCostoIds: ["taller"] }), luis, { agregado: false, admin: false })).toBe(false);
    expect(C.participa(conv(), { id: "x", centroCostoId: null }, null)).toBe(false);
  });
  it("un grupo archivado no se ve", () => {
    expect(C.puedeVer(conv({ todos: true, archivada: true }), ana, null)).toBe(false);
  });
  it("en un grupo de anuncios solo escriben los encargados", () => {
    const g = conv({ todos: true, soloAnuncios: true });
    expect(C.motivoNoEscribir(g, ana, null, true)).toMatch(/solo escriben/);
    expect(C.motivoNoEscribir(g, ana, { agregado: true, admin: true }, true)).toBeNull();
    expect(C.motivoNoEscribir(conv({ todos: true }), ana, null, true)).toBeNull();
    expect(C.motivoNoEscribir(conv({ centroCostoIds: ["ventas"] }), ana, null, true)).toMatch(/No sos parte/);
  });
});

describe("consulta con RR.HH. y charlas directas", () => {
  it("la consulta es solo de su dueño", () => {
    const c = conv({ tipo: "rrhh", empleadoId: "ana", clave: C.claveRRHH("ana") });
    expect(C.puedeVer(c, ana, null)).toBe(true);
    expect(C.puedeVer(c, luis, { agregado: true, admin: true })).toBe(false);
  });
  it("la directa es de los dos y de nadie más", () => {
    const c = conv({ tipo: "directo", clave: C.claveDirecta("ana", "luis") });
    expect(C.puedeVer(c, ana, null)).toBe(true);
    expect(C.puedeVer(c, luis, null)).toBe(true);
    expect(C.puedeVer(c, { id: "eva", centroCostoId: "taller" }, { agregado: true, admin: false })).toBe(false);
  });
  it("si la empresa desactiva los directos, se leen pero no se escribe; con RR.HH. siempre", () => {
    const c = conv({ tipo: "directo", clave: C.claveDirecta("ana", "luis") });
    expect(C.motivoNoEscribir(c, ana, null, false)).toMatch(/desactivó/);
    expect(C.motivoNoEscribir(c, ana, null, true)).toBeNull();
    expect(C.motivoNoEscribir(conv({ tipo: "rrhh", empleadoId: "ana" }), ana, null, false)).toBeNull();
  });
});

describe("notificaciones", () => {
  it("avisa el primer mensaje y a quien estaba al día; no insiste a quien ya tiene sin leer", () => {
    expect(C.tocaNotificar(null, null)).toBe(true); // primer mensaje de la conversación
    expect(C.tocaNotificar(d("2026-10-11T10:05Z"), d("2026-10-11T10:00Z"))).toBe(true); // leyó después del anterior
    expect(C.tocaNotificar(d("2026-10-11T10:00Z"), d("2026-10-11T10:00Z"))).toBe(true); // el anterior era suyo
    expect(C.tocaNotificar(d("2026-10-11T09:00Z"), d("2026-10-11T10:00Z"))).toBe(false); // ya tenía uno sin leer
    expect(C.tocaNotificar(null, d("2026-10-11T10:00Z"))).toBe(false); // nunca la abrió y ya se le avisó
  });
  it("vista previa", () => {
    expect(C.vistaPrevia("Pablo Duarte", "Hola\n¿todo bien?", true)).toBe("Pablo: Hola ¿todo bien?");
    expect(C.vistaPrevia("Pablo Duarte", "Hola", false)).toBe("Hola");
  });
});
