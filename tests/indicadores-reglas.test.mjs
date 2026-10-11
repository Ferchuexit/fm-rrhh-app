// Indicadores de Gestión Humana (lib/indicadores-reglas.ts).
import { describe, it, expect } from "vitest";
import * as I from "../lib/indicadores-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const per = (id, ingreso, egreso = null, motivo = null) => ({ id, fechaIngreso: d(ingreso), fechaEgreso: egreso ? d(egreso) : null, activo: !egreso, motivo });
const dia = (legajoId, fecha, estado) => ({ legajoId, fecha: d(fecha), estado });

describe("porcentajes y períodos", () => {
  it("sin base no hay porcentaje (null, no cero)", () => {
    expect(I.pct(1, 0)).toBeNull();
    expect(I.pct(1, 3)).toBe(33.3);
    expect(I.pct(0, 5)).toBe(0);
  });
  it("los últimos meses, cruzando el año, y el actual cortado en hoy", () => {
    const m = I.ultimosMeses(d("2026-02-10"), 3);
    expect(m.map((x) => x.clave)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(m[0].rotulo).toBe("dic 25");
    expect(m[1].hasta).toEqual(d("2026-01-31"));
    expect(m[2].hasta).toEqual(d("2026-02-10"));
  });
});

describe("dotación y rotación", () => {
  const gente = [per("a", "2020-01-01"), per("b", "2024-03-01"), per("c", "2026-02-10"), per("d", "2019-05-01", "2026-03-15", "renuncia"), per("e", "2026-01-20", "2026-03-01", "fin_contrato"), per("f", "2018-01-01", "2025-06-30", "despido_sin_causa")];
  it("dotación a una fecha", () => {
    expect(I.dotacionAl(gente, d("2025-12-31"))).toBe(3); // a, b, d
    expect(I.dotacionAl(gente, d("2026-02-28"))).toBe(5); // + c, e
    expect(I.dotacionAl(gente, d("2026-03-31"))).toBe(3);
    // El día del egreso ya no cuenta.
    expect(I.dotacionAl(gente, d("2026-03-15"))).toBe(3);
  });
  it("una baja sin fecha no se cuenta en ningún momento", () => {
    expect(I.dotacionAl([{ id: "x", fechaIngreso: d("2020-01-01"), fechaEgreso: null, activo: false, motivo: null }], d("2026-01-01"))).toBe(0);
  });
  it("altas y bajas por mes", () => {
    const m = I.movimientoPorMes(gente, I.ultimosMeses(d("2026-03-31"), 3));
    expect(m.map((x) => [x.mes, x.altas, x.bajas, x.dotacion])).toEqual([["ene 26", 1, 0, 4], ["feb 26", 1, 0, 5], ["mar 26", 0, 2, 3]]);
  });
  it("tasa sobre la dotación promedio, voluntaria, temprana y por motivo", () => {
    const r = I.rotacion(gente, d("2026-01-01"), d("2026-03-31"));
    expect(r).toMatchObject({ bajas: 2, altas: 2, dotacionMedia: 3, tasa: 66.7, voluntarias: 1, tasaVoluntaria: 33.3, tempranas: 1 });
    expect(r.porMotivo.map((x) => x.clave).sort()).toEqual(["fin_contrato", "renuncia"]);
    expect(r.anualizada).toBeGreaterThan(250); // un trimestre llevado al año
  });
  it("sin gente no hay tasa", () => {
    expect(I.rotacion([], d("2026-01-01"), d("2026-03-31"))).toMatchObject({ bajas: 0, tasa: null, anualizada: null });
  });
  it("antigüedad promedio de los que están", () => {
    expect(I.antiguedadPromedio([per("a", "2024-01-01"), per("b", "2022-01-01"), per("c", "2010-01-01", "2020-01-01")], d("2026-01-01"))).toBe(3);
    expect(I.antiguedadPromedio([], d("2026-01-01"))).toBeNull();
  });
});

describe("ausentismo", () => {
  const dias = [dia("a", "2026-10-01", "P"), dia("a", "2026-10-02", "T"), dia("a", "2026-10-03", "FRANCO"), dia("a", "2026-10-05", "A"), dia("b", "2026-10-01", "E"), dia("b", "2026-10-02", "AC"), dia("b", "2026-10-05", "SUS"), dia("b", "2026-10-06", "AA"), dia("c", "2026-10-01", "VC"), dia("c", "2026-10-02", "LP"), dia("c", "2026-10-05", "F"), dia("c", "2026-10-06", "SA")];
  it("francos, feriados, vacaciones y licencias pagas no cuentan ni arriba ni abajo", () => {
    const r = I.ausentismo(dias);
    expect(r.laborables).toBe(8);
    expect(r.ausencias).toBe(5);
    expect(r.tasa).toBe(62.5);
    expect(r.porTipo).toEqual({ injustificada: 1, aviso: 1, enfermedad: 1, art: 1, suspension: 1 });
    expect(r.tardanzas).toBe(1);
    expect(r.puntualidad).toBe(66.7); // de 3 presentes, 1 llegó tarde
  });
  it("sin asistencia cargada no hay tasa", () => {
    expect(I.ausentismo([]).tasa).toBeNull();
    expect(I.ausentismo([dia("a", "2026-10-03", "FRANCO")]).tasa).toBeNull();
  });
  it("por mes", () => {
    const m = I.ausentismoPorMes([...dias, dia("a", "2026-09-10", "P"), dia("a", "2026-09-11", "A")], I.ultimosMeses(d("2026-10-11"), 2));
    expect(m.map((x) => [x.mes, x.tasa])).toEqual([["sep 26", 50], ["oct 26", 62.5]]);
  });
});

describe("licencias prolongadas", () => {
  const corrida = (id, desde, n, estado) => Array.from({ length: n }, (_, i) => dia(id, new Date(d(desde).getTime() + i * 86400000).toISOString().slice(0, 10), estado));
  const hoy = d("2026-10-20");
  it("10 días corridos o más, y que siga", () => {
    const r = I.licenciasProlongadas([...corrida("a", "2026-10-05", 14, "E"), ...corrida("b", "2026-10-12", 5, "E"), ...corrida("c", "2026-09-01", 20, "AC")], hoy);
    expect(r.map((x) => [x.legajoId, x.tipo, x.dias])).toEqual([["a", "enfermedad", 14]]); // b es corta; c terminó hace un mes
  });
  it("los francos del medio no la cortan; un día trabajado sí", () => {
    const conFrancos = [...corrida("a", "2026-10-05", 5, "E"), dia("a", "2026-10-10", "FRANCO"), dia("a", "2026-10-11", "FRANCO"), ...corrida("a", "2026-10-12", 6, "E")];
    expect(I.licenciasProlongadas(conFrancos, hoy)[0]).toMatchObject({ dias: 13, desde: d("2026-10-05") });
    const volvio = [...corrida("a", "2026-10-01", 8, "E"), dia("a", "2026-10-09", "P"), ...corrida("a", "2026-10-10", 8, "E")];
    expect(I.licenciasProlongadas(volvio, hoy)).toEqual([]);
  });
  it("ART también; ausencias comunes no", () => {
    expect(I.licenciasProlongadas(corrida("a", "2026-10-08", 12, "AC"), hoy)[0].tipo).toBe("art");
    expect(I.licenciasProlongadas(corrida("a", "2026-10-08", 12, "A"), hoy)).toEqual([]);
  });
});

describe("vacaciones, tareas y semáforo", () => {
  it("cuánta gente va a estar afuera y el día pico", () => {
    const v = (id, a, b) => ({ legajoId: id, fechaDesde: d(a), fechaHasta: d(b) });
    const r = I.vacacionesAFuturo([v("a", "2026-10-10", "2026-10-12"), v("b", "2026-10-20", "2026-10-30"), v("c", "2026-10-25", "2026-10-27"), v("d", "2027-01-01", "2027-01-14")], d("2026-10-11"));
    expect(r.hoy).toBe(1);
    expect(r.enElPlazo).toBe(3);
    expect(r.pico).toEqual({ fecha: d("2026-10-25"), personas: 2 });
  });
  it("tareas: avance, vencidas y a tiempo (lo que no aplica no cuenta)", () => {
    const t = (vence, hecha, aplica = true) => ({ vence: d(vence), hechaEn: hecha ? new Date(hecha) : null, aplica });
    const r = I.cumplimientoTareas([t("2026-10-05", "2026-10-05T18:00:00Z"), t("2026-10-05", "2026-10-08T10:00:00Z"), t("2026-10-08", null), t("2026-10-20", null), t("2026-10-01", null, false)], d("2026-10-11"));
    expect(r).toEqual({ total: 4, hechas: 2, vencidas: 1, avance: 50, aTiempo: 50 });
    expect(I.cumplimientoTareas([], d("2026-10-11"))).toMatchObject({ avance: null, aTiempo: null });
  });
  it("semáforo para los dos lados", () => {
    expect([2, 3, 5, 9].map((v) => I.estadoDe("ausentismo", v))).toEqual(["bien", "bien", "atencion", "critico"]);
    expect([95, 90, 75, 40].map((v) => I.estadoDe("documentacion", v))).toEqual(["bien", "bien", "atencion", "critico"]);
    expect(I.estadoDe("clima", null)).toBe("sin_dato");
  });
});

describe("para mirar", () => {
  const base = { rotacionAnual: 8, bajasTempranas: 0, ausentismo: 2, sinAviso: 0, prolongadas: 0, clima: 80, documentacion: 95, docPendientesRrhh: 0, constanciasSinFirmar: 0, habilidadesVencidas: 0, habilidadesPorVencer: 0, tareasIngresoVencidas: 0, tareasEgresoVencidas: 0, egresosSinEntrevista: 0, vacantes: 0, busquedasViejas: 0, candidatosSinRevisar: 0, evaluacionesPendientes: 0, objetivosVencidos: 0, picoVacaciones: 1, dotacion: 40 };
  it("con todo en orden no señala nada", () => {
    expect(I.alertas(base)).toEqual([]);
  });
  it("lo crítico va primero, y sin datos no inventa alertas", () => {
    const a = I.alertas({ ...base, ausentismo: 5, documentacion: 40, habilidadesVencidas: 2, tareasIngresoVencidas: 1, clima: null, rotacionAnual: null });
    expect(a.map((x) => x.nivel)).toEqual(["critico", "critico", "atencion", "atencion"]);
    expect(a[0].texto).toMatch(/40 %/);
    expect(a.some((x) => /encuesta|rotación/.test(x.texto))).toBe(false);
  });
  it("avisa si se junta mucha gente de vacaciones", () => {
    expect(I.alertas({ ...base, picoVacaciones: 12 })[0].texto).toMatch(/12 personas de vacaciones a la vez \(30 %/);
    expect(I.alertas({ ...base, dotacion: 3, picoVacaciones: 2 })).toEqual([]); // con 3 personas no tiene sentido
  });
});
