// tests/embargos-prioridad.test.mjs
//
// Antes de esto, un legajo con embargo judicial Y comercial a la vez se
// calculaba cada uno por separado contra el mismo neto — podía terminar
// descontando más del 100% del neto sin darse cuenta. La regla legal real
// (confirmada en múltiples fuentes: "las deudas alimentarias tienen
// carácter preferencial") es que la cuota alimentaria tiene PRIORIDAD
// sobre el embargo comercial — si no alcanza, el comercial cede.
import { describe, it, expect } from "vitest";
import { procesarEmbargosDelLegajo } from "../lib/motor/motor-embargos.mjs";

describe("procesarEmbargosDelLegajo — casos simples (sin conflicto)", () => {
  it("solo judicial: se aplica completo, sin tocar el comercial", () => {
    const r = procesarEmbargosDelLegajo({ netoPreEmbargos: 900000, embargosJudiciales: [{ porcentaje: 30 }], embargoComercialSolicitado: 0 });
    expect(r.totalJudicial).toBe(270000);
    expect(r.comercialAplicado).toBe(0);
    expect(r.advertencias).toHaveLength(0);
  });

  it("solo comercial, alcanza de sobra: se aplica completo", () => {
    const r = procesarEmbargosDelLegajo({ netoPreEmbargos: 900000, embargosJudiciales: [], embargoComercialSolicitado: 150000 });
    expect(r.comercialAplicado).toBe(150000);
    expect(r.advertencias).toHaveLength(0);
  });
});

describe("procesarEmbargosDelLegajo — el caso importante: ambos a la vez, no alcanza para los dos", () => {
  it("el judicial se lleva su porcentaje completo (prioridad), el comercial se recorta a lo que queda", () => {
    // Judicial 30% de 900.000 = 270.000. Queda 630.000 disponible.
    // Comercial pedía 700.000 -> solo puede llevarse 630.000.
    const r = procesarEmbargosDelLegajo({ netoPreEmbargos: 900000, embargosJudiciales: [{ porcentaje: 30 }], embargoComercialSolicitado: 700000 });
    expect(r.totalJudicial).toBe(270000);
    expect(r.comercialAplicado).toBe(630000);
  });

  it("la suma de ambos NUNCA supera el neto disponible", () => {
    const r = procesarEmbargosDelLegajo({ netoPreEmbargos: 900000, embargosJudiciales: [{ porcentaje: 30 }], embargoComercialSolicitado: 700000 });
    expect(r.totalEmbargado).toBeLessThanOrEqual(900000);
    expect(r.totalEmbargado).toBe(900000); // en este caso puntual, consume el 100% justo
  });

  it("avisa cuando tuvo que recortar el comercial por la prioridad del judicial", () => {
    const r = procesarEmbargosDelLegajo({ netoPreEmbargos: 900000, embargosJudiciales: [{ porcentaje: 30 }], embargoComercialSolicitado: 700000 });
    expect(r.advertencias.some((a) => a.includes("prioridad"))).toBe(true);
  });

  it("si el judicial ya consume TODO el neto, el comercial queda en cero (no negativo)", () => {
    const r = procesarEmbargosDelLegajo({ netoPreEmbargos: 900000, embargosJudiciales: [{ porcentaje: 100 }], embargoComercialSolicitado: 50000 });
    expect(r.totalJudicial).toBe(900000);
    expect(r.comercialAplicado).toBe(0);
  });
});

describe("procesarEmbargosDelLegajo — aviso de tope combinado alto (no confirmado al 100%, por eso avisa en vez de bloquear)", () => {
  it("avisa si el total embargado supera el 50% del neto", () => {
    const r = procesarEmbargosDelLegajo({ netoPreEmbargos: 900000, embargosJudiciales: [{ porcentaje: 70 }], embargoComercialSolicitado: 50000 });
    expect(r.totalEmbargado / 900000).toBeGreaterThan(0.5);
    expect(r.advertencias.some((a) => a.includes("50-70%"))).toBe(true);
  });

  it("no avisa por el tope combinado si el total queda por debajo del 50%", () => {
    const r = procesarEmbargosDelLegajo({ netoPreEmbargos: 900000, embargosJudiciales: [{ porcentaje: 20 }], embargoComercialSolicitado: 50000 });
    expect(r.advertencias.some((a) => a.includes("50-70%"))).toBe(false);
  });
});
