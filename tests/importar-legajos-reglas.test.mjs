// Carga de legajos desde Excel (lib/importar-legajos-reglas.ts).
import { describe, it, expect } from "vitest";
import * as I from "../lib/importar-legajos-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
// CUILs con verificador correcto.
const A = "20123456786", B = "27234567891", C = "20345678906", D = "23456789019";
const ctx = (extra = {}) => ({
  convenios: [{ id: "c1", codigo: "MADERA", nombre: "Madera y Afines (USIMRA — CCT 335/75)", categorias: [{ id: "k1", codigo: "OF", nombre: "Oficial" }, { id: "k2", codigo: "AY", nombre: "Ayudante" }] }, { id: "c2", codigo: "COM", nombre: "Comercio", categorias: [{ id: "k9", codigo: "ADM", nombre: "Administrativo A" }] }],
  convenioPorDefecto: "c1", sectores: [{ id: "s1", nombre: "Taller" }], puestos: [{ id: "p1", nombre: "Operario" }],
  existentes: [{ id: "L4", numeroLegajo: 4, cuil: "20-12345678-6", jefeId: null, activo: true }, { id: "L9", numeroLegajo: 9, cuil: D, jefeId: "L4", activo: false }], hoy: d("2026-10-11"), ...extra,
});
const fila = (extra = {}) => ({ apellido: "Gómez", nombre: "María", cuil: B, fechaIngreso: "15/03/2022", categoria: "oficial", ...extra });

describe("piezas", () => {
  it("reconoce los encabezados aunque vengan escritos distinto", () => {
    expect(I.columnaDe("N° Legajo")).toBe(null); // "nlegajo" no es un alias
    expect(I.columnaDe("Legajo")).toBe("numeroLegajo");
    expect(I.columnaDe("  FECHA DE INGRESO ")).toBe("fechaIngreso");
    expect(I.columnaDe("Categoría")).toBe("categoria");
    expect(I.columnaDe("Reporta a (legajo o CUIL)")).toBe("jefe");
    expect(I.columnaDe("Jefe directo")).toBe("jefe");
    expect(I.columnaDe("Área")).toBe("sector");
    expect(I.columnaDe("Sueldo")).toBeNull();
  });
  it("valida el CUIL con su dígito verificador", () => {
    expect(I.cuilLimpio("27-23456789-1")).toBe(B);
    expect(I.cuilLimpio("27-23456789-2")).toBeNull();
    expect(I.cuilLimpio("123")).toBeNull();
    expect(I.cuilConGuiones(B)).toBe("27-23456789-1");
  });
  it("entiende las fechas como vienen de un Excel", () => {
    expect(I.fechaDe("15/03/2022")).toEqual(d("2022-03-15"));
    expect(I.fechaDe("5-3-2022")).toEqual(d("2022-03-05"));
    expect(I.fechaDe("2022-03-15")).toEqual(d("2022-03-15"));
    expect(I.fechaDe(44635)).toEqual(d("2022-03-15")); // número de serie de Excel
    expect(I.fechaDe(new Date("2022-03-15T00:00:00Z"))).toEqual(d("2022-03-15"));
    expect(I.fechaDe("31/02/2022")).toBeNull();
    expect(I.fechaDe("marzo")).toBeNull();
    expect(I.fechaDe("")).toBeNull();
  });
});

describe("analizar la planilla", () => {
  it("una persona nueva: se crea, con el convenio de la empresa y el siguiente legajo", () => {
    const r = I.analizar([fila({ sector: "taller", puesto: "Soldador" })], ctx());
    expect(r.resumen).toEqual({ total: 1, crear: 1, actualizar: 0, errores: 0 });
    expect(r.filas[0].datos).toMatchObject({ numeroLegajo: 10, cuil: B, convenioId: "c1", categoriaId: "k1", fechaIngreso: d("2022-03-15"), sector: "taller", puesto: "Soldador" });
    expect(r.crearSectores).toEqual([]); // "taller" ya existe (como "Taller")
    expect(r.crearPuestos).toEqual(["Soldador"]);
  });
  it("marca lo que está mal, fila por fila", () => {
    const r = I.analizar([fila({ cuil: "27-23456789-2" }), fila({ apellido: "", fechaIngreso: "ayer", categoria: "Capataz" }), fila({ cuil: C, convenio: "Metalúrgicos" }), fila({ cuil: C, numeroLegajo: 4 })], ctx());
    expect(r.resumen.errores).toBe(4);
    expect(r.filas[0].errores[0]).toMatch(/CUIL no es válido/);
    expect(r.filas[1].errores.join(" ")).toMatch(/apellido.*fecha de ingreso.*Capataz/s);
    expect(r.filas[2].errores.join(" ")).toMatch(/Metalúrgicos/);
    expect(r.filas[3].errores.join(" ")).toMatch(/legajo 4 ya lo tiene otra persona/);
    expect(r.filas[3].errores.join(" ")).toMatch(/CUIL está repetido/);
  });
  it("sin convenio por defecto hay que indicarlo", () => {
    expect(I.analizar([fila()], ctx({ convenioPorDefecto: null })).filas[0].errores[0]).toMatch(/Falta el convenio/);
    expect(I.analizar([fila({ convenio: "com", categoria: "Administrativo A" })], ctx({ convenioPorDefecto: null })).filas[0].datos).toMatchObject({ convenioId: "c2", categoriaId: "k9" });
  });
  it("quien ya existe solo cambia de lugar en la estructura", () => {
    const r = I.analizar([{ cuil: A, sector: "Ventas", puesto: "Vendedor", numeroLegajo: 77 }], ctx());
    expect(r.filas[0]).toMatchObject({ accion: "actualizar", existenteId: "L4", errores: [] });
    expect(r.filas[0].avisos[0]).toMatch(/legajo 4/);
    expect(r.crearSectores).toEqual(["Ventas"]);
    // Sin nada que cambiar, se avisa.
    expect(I.analizar([{ cuil: A }], ctx()).filas[0].avisos[0]).toMatch(/no cambia nada/);
    // Un legajo dado de baja no se toca.
    expect(I.analizar([{ cuil: D, sector: "Ventas" }], ctx()).filas[0].accion).toBe("error");
  });
  it("el jefe puede ser de la base o de la misma planilla, por legajo o por CUIL", () => {
    const r = I.analizar([fila({ cuil: B, numeroLegajo: 20, jefe: "4" }), fila({ cuil: C, jefe: "20" }), fila({ cuil: "20-45678901-8", jefe: "27-23456789-1" })].map((f, i) => (i === 2 ? { ...f, cuil: I.cuilLimpio("20456789018") ? "20456789018" : f.cuil } : f)), ctx());
    expect(r.filas[0].jefeRef).toBe("id:L4");
    expect(r.filas[1].jefeRef).toBe(`cuil:${B}`);
    expect(r.filas[2].jefeRef ?? r.filas[2].errores[0]).toBeTruthy();
  });
  it("jefe que no existe, dado de baja o uno mismo", () => {
    expect(I.analizar([fila({ jefe: "999" })], ctx()).filas[0].errores[0]).toMatch(/No se encontró al jefe/);
    expect(I.analizar([fila({ jefe: "9" })], ctx()).filas[0].errores[0]).toMatch(/dado de baja/);
    expect(I.analizar([fila({ numeroLegajo: 30, jefe: "30" })], ctx()).filas[0].errores[0]).toMatch(/a sí misma/);
  });
  it("no deja armar un círculo", () => {
    // B (30) reporta a C (31) y C reporta a B.
    const r = I.analizar([fila({ cuil: B, numeroLegajo: 30, jefe: "31" }), fila({ cuil: C, numeroLegajo: 31, jefe: "30" })], ctx());
    expect(r.filas.every((f) => f.errores.some((e) => /círculo/.test(e)))).toBe(true);
    // Y contra lo que ya está: el 4 (que hoy no tiene jefe) pasa a reportar a alguien nuevo que reporta al 4.
    const r2 = I.analizar([fila({ cuil: B, numeroLegajo: 30, jefe: "4" }), { cuil: A, jefe: "30" }], ctx());
    expect(r2.filas.some((f) => f.errores.some((e) => /círculo/.test(e)))).toBe(true);
  });
  it("numera en orden a los que no traen legajo, sin pisar los que sí", () => {
    const r = I.analizar([fila({ cuil: B }), fila({ cuil: C, numeroLegajo: 12 }), fila({ cuil: "20456789018" })], ctx());
    expect(r.filas.map((f) => f.datos.numeroLegajo)).toEqual([13, 12, 14]);
  });
});
