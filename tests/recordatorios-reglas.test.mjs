// Recordatorios automáticos (lib/recordatorios-reglas.ts).
import { describe, it, expect } from "vitest";
import * as R from "../lib/recordatorios-reglas.ts";

const d = (s) => new Date(s + "T00:00:00Z");
const hoy = d("2026-10-12"); // lunes

describe("cuándo toca", () => {
  it("con fecha límite: los días indicados antes, y una vez por semana si se venció", () => {
    const limite = d("2026-10-15");
    const dias = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-21", "2026-10-22", "2026-10-29", "2026-10-30"];
    expect(dias.filter((x) => R.tocaPorLimite(d(x), limite, [3, 0]))).toEqual(["2026-10-12", "2026-10-15", "2026-10-22", "2026-10-29"]);
  });
  it("algo que quedó esperando: a los 3 días, después semanal, y corta al mes", () => {
    const desde = new Date("2026-10-01T18:30:00Z"); // con hora: cuenta por días
    const tocan = [];
    for (let i = 0; i <= 45; i++) { const x = new Date(d("2026-10-01").getTime() + i * 86400000); if (R.tocaInsistir(x, desde)) tocan.push(i); }
    expect(tocan).toEqual([3, 10, 17, 24, 31]);
  });
  it("reconoce el lunes", () => {
    expect(R.esLunes(hoy)).toBe(true);
    expect(R.esLunes(d("2026-10-13"))).toBe(false);
  });
});

describe("textos", () => {
  it("dicen el plazo según cuánto falta", () => {
    expect(R.recordatorioEvaluaciones(2, hoy, d("2026-10-15"))).toMatchObject({ titulo: "Te faltan completar 2 evaluaciones", cuerpo: "De tu equipo. Tenés hasta el 15/10." });
    expect(R.recordatorioEvaluaciones(1, hoy, hoy).cuerpo).toMatch(/vence hoy/);
    expect(R.recordatorioAutoevaluacion(hoy, d("2026-10-13")).cuerpo).toMatch(/vence mañana/);
    expect(R.recordatorioAutoevaluacion(hoy, d("2026-10-05")).cuerpo).toBe("El plazo venció el 05/10.");
    expect(R.recordatorioObjetivos(1, hoy, hoy).titulo).toBe("Hoy vence uno de tus objetivos");
    expect(R.recordatorioObjetivos(3, hoy, d("2026-10-19")).titulo).toBe("3 de tus objetivos vencen el 19/10");
    expect(R.recordatorioHabilidadVence(hoy, d("2026-10-19")).titulo).toMatch(/esta semana/);
    expect(R.recordatorioHabilidadVence(hoy, d("2026-11-11")).titulo).toMatch(/el 11\/11/);
  });
  it("ninguno lleva datos sensibles: el de capacitación solo el título", () => {
    expect(R.recordatorioCapacitacionManiana("Uso seguro del autoelevador").cuerpo).toBe("Uso seguro del autoelevador");
    expect(R.recordatorioRecibos(2)).toMatchObject({ titulo: "Tenés 2 recibos sin firmar", url: "/portal/recibos" });
  });
});

describe("resumen semanal para RR.HH.", () => {
  const cero = { solicitudes: 0, evaluacionesVencidas: 0, evaluacionesSinEntregar: 0, objetivosVencidos: 0, habilidadesVencidas: 0, habilidadesPorVencer: 0, capacitacionesSinCerrar: 0, recibosSinFirmar: 0 };
  it("sin pendientes no hay líneas (y no sale mail)", () => {
    expect(R.lineasResumen(cero)).toEqual([]);
  });
  it("solo lo que tiene algo, en singular o plural", () => {
    const l = R.lineasResumen({ ...cero, solicitudes: 1, objetivosVencidos: 4, capacitacionesSinCerrar: 1 });
    expect(l.map((x) => x.texto)).toEqual(["1 pedido de vacaciones o permiso esperando respuesta", "4 objetivos vencidos sin cerrar", "1 capacitación ya pasó y falta cerrarla"]);
    expect(l[1].url).toBe("/objetivos");
  });
  it("el mail escapa lo que viene de la base", () => {
    const html = R.htmlResumen("Moras <S.A.>", [{ texto: "1 cosa", url: "/x" }], "https://ejemplo.com");
    expect(html).toContain("Moras &lt;S.A.&gt;");
    expect(html).toContain('href="https://ejemplo.com/x"');
  });
});
