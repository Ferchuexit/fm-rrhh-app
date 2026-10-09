// Portal del empleado — reglas de pedidos de vacaciones/permisos (lib/ausencias-reglas.ts).
import { describe, it, expect } from "vitest";
import { fechaDesdeTexto, hoyArgentina, diasCorridos, seSuperponen, calcularSaldo, validarPedido, MAX_DIAS_PEDIDO } from "../lib/ausencias-reglas.ts";

const f = (t) => fechaDesdeTexto(t);
const base = { tipo: "vacaciones", desde: f("2026-11-02"), hasta: f("2026-11-15"), motivo: "", hoy: f("2026-10-09"), saldoDisponible: 14, ocupados: [] };

describe("Fechas", () => {
  it("solo acepta fechas reales en formato AAAA-MM-DD", () => {
    expect(f("2026-11-02").toISOString()).toBe("2026-11-02T00:00:00.000Z");
    for (const t of ["", "02/11/2026", "2026-02-30", "2026-13-01", "2026-11-2", null, undefined, "hoy"]) expect(f(t), String(t)).toBeNull();
    expect(f("2028-02-29")).not.toBeNull(); // bisiesto
    expect(f("2027-02-29")).toBeNull();
  });

  it("el 'hoy' es el de Argentina, no el del servidor", () => {
    // 01:30 UTC del día 10 = 22:30 del día 9 en Buenos Aires
    expect(hoyArgentina(new Date("2026-10-10T01:30:00Z")).toISOString().slice(0, 10)).toBe("2026-10-09");
    expect(hoyArgentina(new Date("2026-10-10T03:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-10");
  });

  it("cuenta días corridos con los dos extremos", () => {
    expect(diasCorridos(f("2026-11-02"), f("2026-11-02"))).toBe(1);
    expect(diasCorridos(f("2026-11-02"), f("2026-11-15"))).toBe(14);
    expect(diasCorridos(f("2026-12-22"), f("2027-01-04"))).toBe(14); // cruza de año
  });

  it("detecta superposición, incluso de un solo día en el borde", () => {
    expect(seSuperponen(f("2026-11-02"), f("2026-11-15"), f("2026-11-15"), f("2026-11-20"))).toBe(true);
    expect(seSuperponen(f("2026-11-02"), f("2026-11-15"), f("2026-11-16"), f("2026-11-20"))).toBe(false);
    expect(seSuperponen(f("2026-11-05"), f("2026-11-06"), f("2026-11-01"), f("2026-11-30"))).toBe(true);
  });
});

describe("Saldo de vacaciones", () => {
  const legajo = (ingreso, reconocida = null) => ({ fechaIngreso: new Date(ingreso), antiguedadReconocida: reconocida ? new Date(reconocida) : null });

  it("tramos del art. 150 LCT según antigüedad al 31/12", () => {
    expect(calcularSaldo(legajo("2024-03-01"), 2026, 0, 0).corresponden).toBe(14);
    expect(calcularSaldo(legajo("2020-03-01"), 2026, 0, 0).corresponden).toBe(21);
    expect(calcularSaldo(legajo("2014-03-01"), 2026, 0, 0).corresponden).toBe(28);
    expect(calcularSaldo(legajo("2004-03-01"), 2026, 0, 0).corresponden).toBe(35);
  });

  it("usa la antigüedad reconocida si está cargada", () => {
    expect(calcularSaldo(legajo("2024-03-01", "2015-03-01"), 2026, 0, 0).corresponden).toBe(28);
  });

  it("descuenta lo registrado y lo que está en trámite, sin bajar de cero", () => {
    expect(calcularSaldo(legajo("2024-03-01"), 2026, 7, 0).disponibles).toBe(7);
    expect(calcularSaldo(legajo("2024-03-01"), 2026, 7, 5).disponibles).toBe(2);
    expect(calcularSaldo(legajo("2024-03-01"), 2026, 14, 5).disponibles).toBe(0);
  });
});

describe("Validación de un pedido", () => {
  it("acepta un pedido normal", () => expect(validarPedido(base)).toBeNull());

  it("rechaza tipo inválido, fechas faltantes o invertidas", () => {
    expect(validarPedido({ ...base, tipo: "licencia" })).not.toBeNull();
    expect(validarPedido({ ...base, desde: null })).not.toBeNull();
    expect(validarPedido({ ...base, hasta: f("2026-11-01") })).toMatch(/anterior/);
  });

  it("no deja pedir para atrás, pero sí para hoy", () => {
    expect(validarPedido({ ...base, desde: f("2026-10-08"), hasta: f("2026-10-08"), tipo: "permiso", motivo: "Trámite ANSES" })).toMatch(/ya pasó/);
    expect(validarPedido({ ...base, desde: f("2026-10-09"), hasta: f("2026-10-09"), tipo: "permiso", motivo: "Trámite ANSES" })).toBeNull();
  });

  it("vacaciones: no puede pedir más de lo que le queda", () => {
    expect(validarPedido({ ...base, saldoDisponible: 13 })).toMatch(/te quedan 13/);
    expect(validarPedido({ ...base, saldoDisponible: 0 })).toMatch(/No te quedan/);
  });

  it("permiso: exige motivo y NO mira el saldo de vacaciones", () => {
    expect(validarPedido({ ...base, tipo: "permiso", motivo: "", saldoDisponible: 0 })).toMatch(/para qué/);
    expect(validarPedido({ ...base, tipo: "permiso", motivo: "Examen final", saldoDisponible: 0 })).toBeNull();
  });

  it("no deja pisar fechas que ya tiene, y dice con qué choca", () => {
    const ocupados = [{ desde: f("2026-11-15"), hasta: f("2026-11-20"), descripcion: "vacaciones ya registradas (15/11 al 20/11)" }];
    expect(validarPedido({ ...base, ocupados })).toMatch(/15\/11 al 20\/11/);
    expect(validarPedido({ ...base, hasta: f("2026-11-14"), ocupados })).toBeNull();
  });

  it("tope de días por pedido", () => {
    const hasta = new Date(base.desde.getTime() + MAX_DIAS_PEDIDO * 86400000);
    expect(validarPedido({ ...base, tipo: "permiso", motivo: "Viaje largo", hasta })).toMatch(/superar/);
  });
});
