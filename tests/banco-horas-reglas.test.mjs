// Banco de horas (lib/banco-horas-reglas.ts).
import { describe, it, expect } from "vitest";
import * as B from "../lib/banco-horas-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const hoy = d("2026-10-12");
const mov = (id, tipo, fecha, minutos, extra = {}) => ({ id, tipo, fecha: d(fecha), minutos, minutosTrabajados: null, recargo: null, estado: "aprobado", anulado: false, ...extra });
const acr = (id, fecha, trabajados, recargo, equivalencia = "recargo") => mov(id, "acreditacion", fecha, B.descansoQueGenera(trabajados, recargo, equivalencia), { minutosTrabajados: trabajados, recargo });

describe("horas", () => {
  it("entiende 2, 1:30, 1,5 y rechaza basura", () => {
    expect(B.minutosDesdeTexto("2")).toBe(120);
    expect(B.minutosDesdeTexto("1:30")).toBe(90);
    expect(B.minutosDesdeTexto("1,5")).toBe(90);
    expect(B.minutosDesdeTexto("0")).toBeNull();
    expect(B.minutosDesdeTexto("1:75")).toBeNull();
    expect(B.minutosDesdeTexto("dos")).toBeNull();
  });
  it("muestra horas", () => {
    expect(B.textoHoras(90)).toBe("1 h 30 min");
    expect(B.textoHoras(120)).toBe("2 h");
    expect(B.textoHoras(-45)).toBe("-45 min");
    expect(B.textoHoras(0)).toBe("0 h");
  });
  it("equivalencia con recargo o simple", () => {
    expect(B.descansoQueGenera(60, 50, "recargo")).toBe(90);
    expect(B.descansoQueGenera(60, 100, "recargo")).toBe(120);
    expect(B.descansoQueGenera(60, 100, "simple")).toBe(60);
  });
});

describe("acuerdo", () => {
  const base = { id: "a", desde: d("2026-10-01"), hasta: null, aceptadoEn: null, enPapel: false, finalizadoEn: null, topeHoras: null, plazoDias: 90, equivalencia: "recargo" };
  it("sin firma no vale", () => {
    expect(B.estadoAcuerdo(base, hoy)).toBe("sin_firmar");
    expect(B.acuerdoDelDia([base], d("2026-10-05"))).toBeNull();
  });
  it("firmado cubre desde su inicio hasta que termina", () => {
    const a = { ...base, enPapel: true, finalizadoEn: d("2026-10-20") };
    expect(B.estadoAcuerdo(a, hoy)).toBe("vigente");
    expect(B.acuerdoDelDia([a], d("2026-09-30"))).toBeNull();
    expect(B.acuerdoDelDia([a], d("2026-10-19"))?.id).toBe("a");
    expect(B.acuerdoDelDia([a], d("2026-10-20"))).toBeNull();
    expect(B.estadoAcuerdo(a, d("2026-10-21"))).toBe("terminado");
  });
  it("valida", () => {
    expect(B.validarAcuerdo({ desde: "2026-01-01" }, hoy).error).toMatch(/más de un mes/);
    expect(B.validarAcuerdo({ desde: "2026-10-12", hasta: "2026-10-01" }, hoy).error).toMatch(/posterior/);
    expect(B.validarAcuerdo({ topeHoras: "1000" }, hoy).error).toMatch(/tope/);
    const ok = B.validarAcuerdo({ desde: "2026-10-12", topeHoras: "40", plazoDias: "120", equivalencia: "simple", origen: "sindical" }, hoy).datos;
    expect(ok).toMatchObject({ topeHoras: 40, plazoDias: 120, equivalencia: "simple", origen: "sindical", hasta: null });
  });
});

describe("cuenta corriente", () => {
  it("usa primero las horas más viejas y avisa lo que vence", () => {
    const movs = [acr("1", "2026-06-01", 120, 50), acr("2", "2026-09-01", 60, 100), mov("3", "compensacion", "2026-09-10", -150)];
    const r = B.lotes(movs, 120, hoy);
    // 180 de descanso del lote 1, se usaron 150 → quedan 30 (vencido: 01/06 + 120 días = 29/09).
    expect(r.lotes[0]).toMatchObject({ restante: 30, estado: "vencido" });
    expect(r.lotes[1]).toMatchObject({ restante: 120, estado: "vigente" });
    expect(r.saldo).toBe(150);
    expect(r.vencido).toBe(30);
  });
  it("no cuenta lo anulado, lo pendiente ni lo rechazado", () => {
    const movs = [acr("1", "2026-10-01", 60, 50), { ...mov("2", "compensacion", "2026-10-02", -60), anulado: true }, { ...mov("3", "compensacion", "2026-10-20", -30), estado: "pendiente" }];
    expect(B.lotes(movs, null, hoy).saldo).toBe(90);
    expect(B.minutosReservados(movs)).toBe(30);
  });
  it("por vencer dentro de 30 días", () => {
    const r = B.lotes([acr("1", "2026-08-01", 60, 50)], 90, hoy); // vence 30/10
    expect(r.porVencer).toBe(90);
  });
  it("pagar vuelve a horas extra reales con su recargo", () => {
    const { lotes } = B.lotes([acr("1", "2026-09-01", 60, 50), acr("2", "2026-09-05", 60, 100)], null, hoy);
    expect(B.horasAPagar(lotes, 90)).toEqual({ m50: 60, m100: 0 });
    expect(B.horasAPagar(lotes, 210)).toEqual({ m50: 60, m100: 60 });
  });
});

describe("horas extra desde las fichadas", () => {
  const prog = { ingreso: "07:00", salida: "16:00", nocturno: false };
  it("solo cuenta lo que se quedó después de la salida, de a media hora", () => {
    expect(B.extraDelDia({ fecha: d("2026-10-07"), programado: prog, feriado: false, ingresoReal: "06:40", egresoReal: "18:20" })).toMatchObject({ m50: 120, m100: 0 });
    expect(B.extraDelDia({ fecha: d("2026-10-07"), programado: prog, feriado: false, ingresoReal: "07:00", egresoReal: "16:25" })).toMatchObject({ m50: 0, m100: 0 });
  });
  it("sábado después de las 13 va al 100 %", () => {
    const sab = { ingreso: "07:00", salida: "12:00", nocturno: false };
    expect(B.extraDelDia({ fecha: d("2026-10-10"), programado: sab, feriado: false, ingresoReal: "07:00", egresoReal: "15:00" })).toMatchObject({ m50: 60, m100: 120 });
  });
  it("franco o domingo: todo lo trabajado; feriado sin horario al 100 %", () => {
    expect(B.extraDelDia({ fecha: d("2026-10-11"), programado: null, feriado: false, ingresoReal: "08:00", egresoReal: "12:00" })).toMatchObject({ m100: 240, m50: 0 });
    expect(B.extraDelDia({ fecha: d("2026-10-12"), programado: null, feriado: true, ingresoReal: "08:00", egresoReal: "12:00" })).toMatchObject({ m100: 240 });
  });
  it("turno noche que se estira", () => {
    const noche = { ingreso: "22:00", salida: "06:00", nocturno: true };
    expect(B.extraDelDia({ fecha: d("2026-10-07"), programado: noche, feriado: false, ingresoReal: "22:00", egresoReal: "07:30" })).toMatchObject({ m50: 90 });
  });
  it("alertas: tope diario, descanso entre jornadas y semana de 48 h", () => {
    const dia = (f, ing, egr, m50) => ({ fecha: d(f), programado: prog, feriado: false, ingresoReal: ing, egresoReal: egr, m50, m100: 0, trabajado: 0 });
    const lista = [dia("2026-10-05", "07:00", "23:00", 420), dia("2026-10-06", "07:00", "16:00", 0)];
    lista[0].trabajado = 960; lista[1].trabajado = 540;
    const a = B.alertasDePersona(lista);
    expect(a.get("2026-10-05")?.join()).toMatch(/3 h diarias/);
    expect(a.get("2026-10-06")?.join()).toMatch(/mínimo es 12 h/);
    const semana = ["05", "06", "07", "08", "09", "10"].map((x) => ({ ...dia(`2026-10-${x}`, "07:00", "16:00", 0), trabajado: 540 }));
    expect(B.alertasDePersona(semana).get("2026-10-10")?.join()).toMatch(/48 h/);
  });
});

describe("movimientos y pedidos", () => {
  it("compensar no puede pasar lo disponible", () => {
    expect(B.validarMovimiento({ tipo: "compensacion", fecha: "2026-10-15", horas: "3" }, 120, hoy).error).toMatch(/2 h disponibles/);
    expect(B.validarMovimiento({ tipo: "compensacion", fecha: "2026-10-15", horas: "2" }, 120, hoy).datos.minutos).toBe(-120);
  });
  it("acreditar a mano: no a futuro", () => {
    expect(B.validarMovimiento({ tipo: "acreditacion", fecha: "2026-10-20", horas: "2" }, 0, hoy).error).toMatch(/todavía no pasó/);
    expect(B.validarMovimiento({ tipo: "acreditacion", fecha: "2026-10-10", horas: "2", recargo: "100" }, 0, hoy).datos).toMatchObject({ minutosTrabajados: 120, recargo: 100 });
  });
  it("ajuste con motivo", () => {
    expect(B.validarMovimiento({ tipo: "ajuste", fecha: "2026-10-10", horas: "1" }, 0, hoy).error).toMatch(/motivo/);
    expect(B.validarMovimiento({ tipo: "ajuste", fecha: "2026-10-10", horas: "1", signo: "-", motivo: "x" }, 30, hoy).error).toMatch(/negativo/);
  });
  it("pedido del portal", () => {
    expect(B.validarPedido({ tipo: "usar", horas: "4", fecha: "2026-10-01" }, 600, hoy).error).toMatch(/hoy o más adelante/);
    expect(B.validarPedido({ tipo: "usar", horas: "4", fecha: "2026-10-20" }, 600, hoy).datos).toMatchObject({ tipo: "compensacion", minutos: 240 });
    expect(B.validarPedido({ tipo: "cobrar", horas: "20" }, 600, hoy).error).toMatch(/10 h disponibles/);
  });
});
