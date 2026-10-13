// Reclamos de haberes (lib/reclamos-reglas.ts) y buscador (lib/buscador-reglas.ts).
import { describe, it, expect } from "vitest";
import * as R from "../lib/reclamos-reglas.ts";
import { coincidencia, normalizar } from "../lib/buscador-reglas.ts";

const M = R.MOTIVOS_ESTANDAR;

describe("motivos", () => {
  it("sin lista propia usa la estándar", () => {
    expect(R.motivosDe(null)).toBe(M);
    expect(R.motivosDe([])).toBe(M);
  });
  it("limpia la lista de la empresa", () => {
    const r = R.limpiarMotivos([{ nombre: "Ajuste día extraordinario UOM", unidad: "dias" }, { nombre: "Plus asistencia", unidad: "monto", concepto: "plus_asis" }]);
    expect(r.motivos[0]).toMatchObject({ id: "ajuste-dia-extraordinario-uom", unidad: "dias", activo: true });
    expect(r.motivos[1].concepto).toBe("PLUS_ASIS");
    expect(R.limpiarMotivos([{ nombre: "Uno" }, { nombre: "uno" }]).error).toMatch(/repetido/);
    expect(R.limpiarMotivos([{ nombre: "Uno", activo: false }]).error).toMatch(/al menos un motivo/);
  });
});

describe("reclamo del empleado", () => {
  it("valida cantidades según la unidad", () => {
    expect(R.validarReclamo({ items: [] }, M).error).toMatch(/al menos un motivo/);
    expect(R.validarReclamo({ items: [{ motivoId: "hs-extra-50" }] }, M).error).toMatch(/las horas/);
    expect(R.validarReclamo({ items: [{ motivoId: "hs-extra-50", cantidad: "500" }] }, M).error).toMatch(/Revisá/);
    expect(R.validarReclamo({ items: [{ motivoId: "otro" }] }, M).error).toMatch(/Contá qué pasó/);
    expect(R.validarReclamo({ items: [{ motivoId: "no-existe" }] }, M).error).toMatch(/ya no está/);
    expect(R.validarReclamo({ items: [{ motivoId: "otro", detalle: "x" }, { motivoId: "otro", detalle: "y" }] }, M).error).toMatch(/dos veces/);
  });
  it("arma los ítems con el nombre del motivo de ese momento", () => {
    const { datos } = R.validarReclamo({ items: [{ motivoId: "hs-extra-50", cantidad: "4,5" }, { motivoId: "presentismo", cantidad: "12.500,50" }], comentario: " faltan " }, M);
    expect(datos.items[0]).toMatchObject({ motivo: "Horas extra al 50 %", unidad: "horas", cantidad: 4.5 });
    expect(datos.items[1].cantidad).toBe(12500.5);
    expect(datos.comentario).toBe("faltan");
  });
  it("muestra cantidades", () => {
    expect(R.textoCantidad("horas", 4.5)).toBe("4,5 h");
    expect(R.textoCantidad("dias", 1)).toBe("1 día");
    expect(R.textoCantidad("monto", 1500)).toBe("$ 1.500,00");
  });
});

describe("respuesta de RR.HH.", () => {
  const items = R.validarReclamo({ items: [{ motivoId: "hs-extra-50", cantidad: "4" }, { motivoId: "presentismo", cantidad: "1000" }] }, M).datos.items;
  it("todo aprobado", () => {
    const r = R.validarResolucion({ items: [{ aprobado: true, cantidad: "4", conceptoCodigo: "HS_EXTRA_50" }, { aprobado: true, cantidad: "1000" }] }, items, ["HS_EXTRA_50"]);
    expect(r.datos).toMatchObject({ estado: "aprobado", conNovedad: true });
  });
  it("en parte o rechazado necesita explicación", () => {
    expect(R.validarResolucion({ items: [{ aprobado: true, cantidad: "2" }, { aprobado: false }] }, items, []).error).toMatch(/Explicale/);
    expect(R.validarResolucion({ items: [{ aprobado: true, cantidad: "2" }, { aprobado: false }], respuesta: "Las otras 2 h ya se pagaron" }, items, []).datos.estado).toBe("parcial");
    expect(R.validarResolucion({ items: [{ aprobado: false }, { aprobado: false }], respuesta: "No" }, items, []).datos.estado).toBe("rechazado");
  });
  it("concepto que no existe o sin cantidad", () => {
    expect(R.validarResolucion({ items: [{ aprobado: true, cantidad: "4", conceptoCodigo: "XX" }, { aprobado: false }], respuesta: "r" }, items, []).error).toMatch(/catálogo/);
    expect(R.validarResolucion({ items: [{ aprobado: true }, { aprobado: false }], respuesta: "r" }, items, []).error).toMatch(/cuánto/);
  });
});

describe("buscador", () => {
  it("sin tildes ni mayúsculas, todas las palabras", () => {
    expect(normalizar(" Núñez ")).toBe("nunez");
    expect(coincidencia("Núñez, Martín", "nunez")).toBeGreaterThan(0);
    expect(coincidencia("Núñez, Martín", "martin nu")).toBeGreaterThan(0);
    expect(coincidencia("Núñez, Martín", "garcia")).toBe(0);
  });
  it("prefiere el inicio de palabra", () => {
    expect(coincidencia("García, Ana", "gar")).toBeGreaterThan(coincidencia("Bogarín, Luis", "gar"));
  });
});
