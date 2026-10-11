// Librería de conocimiento (lib/biblioteca-reglas.ts).
import { describe, it, expect } from "vitest";
import * as B from "../lib/biblioteca-reglas.ts";

const ok = { titulo: "Cómo pedir vacaciones", categoria: "Procedimientos", contenido: "Desde el portal, en Vacaciones." };
const art = (id, titulo, categoria, contenido = null, archivoTexto = null) => ({ id, titulo, categoria, contenido, archivoTexto });

describe("validar un artículo", () => {
  it("acepta y limpia", () => {
    const { datos, error } = B.validarArticulo({ ...ok, titulo: "  Cómo pedir vacaciones ", categoria: " Procedimientos   internos ", centroCostoIds: "a, b,a,", destacado: "true" }, false);
    expect(error).toBeNull();
    expect(datos).toEqual({ titulo: "Cómo pedir vacaciones", categoria: "Procedimientos internos", contenido: "Desde el portal, en Vacaciones.", enlace: null, centroCostoIds: ["a", "b"], destacado: true });
  });
  it("pide título, categoría y algo de contenido (texto, archivo o enlace)", () => {
    expect(B.validarArticulo({ ...ok, titulo: "a" }, false).error).toMatch(/título/);
    expect(B.validarArticulo({ ...ok, categoria: "" }, false).error).toMatch(/categoría/);
    expect(B.validarArticulo({ ...ok, contenido: "  " }, false).error).toMatch(/vacío/);
    expect(B.validarArticulo({ ...ok, contenido: "" }, true).error).toBeNull();
    expect(B.validarArticulo({ ...ok, contenido: "", enlace: "youtu.be/abc" }, false).datos.enlace).toBe("https://youtu.be/abc");
  });
  it("rechaza un enlace que no es una dirección", () => {
    expect(B.validarArticulo({ ...ok, enlace: "ver el video" }, false).error).toMatch(/enlace/);
    expect(B.validarArticulo({ ...ok, enlace: "https://www.youtube.com/watch?v=abc" }, false).error).toBeNull();
  });
  it("el archivo: PDF o imagen, hasta 4 MB, por lo que es", () => {
    expect(B.motivoArchivoInvalido(1000, "application/pdf")).toBeNull();
    expect(B.motivoArchivoInvalido(1000, "image/png")).toBeNull();
    expect(B.motivoArchivoInvalido(1000, null)).toMatch(/PDF o una imagen/);
    expect(B.motivoArchivoInvalido(B.MAX_ARCHIVO_BYTES + 1, "application/pdf")).toMatch(/4 MB/);
  });
});

describe("quién lo ve", () => {
  it("solo lo publicado, y por sector si tiene", () => {
    expect(B.loVe({ estado: "publicado", centroCostoIds: [] }, null)).toBe(true);
    expect(B.loVe({ estado: "borrador", centroCostoIds: [] }, "t")).toBe(false);
    expect(B.loVe({ estado: "archivado", centroCostoIds: [] }, "t")).toBe(false);
    expect(B.loVe({ estado: "publicado", centroCostoIds: ["t"] }, "t")).toBe(true);
    expect(B.loVe({ estado: "publicado", centroCostoIds: ["t"] }, "v")).toBe(false);
    expect(B.loVe({ estado: "publicado", centroCostoIds: ["t"] }, null)).toBe(false);
  });
});

describe("buscador", () => {
  const lista = [
    art("1", "Cómo pedir vacaciones", "Procedimientos", "Se piden desde el portal con 45 días de anticipación."),
    art("2", "Plan de evacuación", "Seguridad e higiene", null, "Ante una alarma, dirigirse al punto de encuentro del playón. No usar el autoelevador."),
    art("3", "Instructivo de la seccionadora", "Máquinas e instructivos", "Antes de pedir asistencia, verificar la guarda."),
    art("4", "Reglamento interno", "Reglamento y normas", "Horarios, vacaciones y licencias."),
  ];
  it("ignora tildes y mayúsculas, y las palabras vacías", () => {
    expect(B.palabrasDe("¿Cómo pido la EVACUACIÓN de el taller?")).toEqual(["pido", "evacuacion", "taller"]);
    expect(B.buscar(lista, "EVACUACION").map((r) => r.articulo.id)).toEqual(["2"]);
  });
  it("el título pesa más que el texto", () => {
    expect(B.buscar(lista, "vacaciones").map((r) => r.articulo.id)).toEqual(["1", "4"]);
  });
  it("tienen que estar todas las palabras", () => {
    expect(B.buscar(lista, "pedir vacaciones").map((r) => r.articulo.id)).toEqual(["1"]);
    expect(B.buscar(lista, "vacaciones autoelevador")).toEqual([]);
  });
  it("busca dentro del PDF y por categoría, y muestra dónde lo encontró", () => {
    const r = B.buscar(lista, "autoelevador");
    expect(r.map((x) => x.articulo.id)).toEqual(["2"]);
    expect(r[0].fragmento).toMatch(/No usar el autoelevador/);
    expect(B.buscar(lista, "seguridad").map((x) => x.articulo.id)).toEqual(["2"]);
  });
  it("sin nada que buscar no devuelve nada", () => {
    expect(B.buscar(lista, "  ")).toEqual([]);
    expect(B.buscar(lista, "de la")).toEqual([]);
  });
});

describe("categorías", () => {
  it("las sugeridas van primero y en su orden; las propias, después", () => {
    const g = B.porCategoria([{ categoria: "Comedor", titulo: "Menú" }, { categoria: "Preguntas frecuentes", titulo: "B" }, { categoria: "Seguridad e higiene", titulo: "Z" }, { categoria: "Seguridad e higiene", titulo: "A" }]);
    expect(g.map((x) => x.categoria)).toEqual(["Seguridad e higiene", "Preguntas frecuentes", "Comedor"]);
    expect(g[0].articulos.map((a) => a.titulo)).toEqual(["A", "Z"]);
    expect(g[0].emoji).toBe("🦺");
    expect(g[2].emoji).toBe("📄");
  });
});
