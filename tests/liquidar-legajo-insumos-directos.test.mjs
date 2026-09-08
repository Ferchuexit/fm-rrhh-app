// tests/liquidar-legajo-insumos-directos.test.mjs
//
// Bug real encontrado al conectar el SAC: un insumo directo (valor que
// viene directo de una Novedad, sin pasar por ninguna ReglaConcepto — el
// SAC es el primer caso real que lo usa) NO contaba para REM_TOTAL()
// porque esa base se armaba antes de que los insumos directos entraran
// al detalle. Esto significaba que un insumo directo remunerativo no
// aportaba jubilación/obra social como debería.
import { describe, it, expect } from "vitest";
import { liquidarLegajo } from "../lib/motor/motor-reglas.mjs";

describe("liquidarLegajo — un insumo directo remunerativo (ej. SAC) aporta correctamente", () => {
  const conceptos = [
    { codigo: "REM_BASICA", tipo: "remunerativo" },
    { codigo: "SAC", tipo: "remunerativo" },
    { codigo: "JUBILACION", tipo: "descuento" },
  ];
  const reglas = [
    { conceptoCodigo: "REM_BASICA", formula: "BASICO", aporta: true, contribuye: true },
    { conceptoCodigo: "JUBILACION", formula: "REM_TOTAL() * 0.11", aporta: false, contribuye: false },
  ];

  it("la Jubilación se calcula sobre básico + SAC, no solo el básico", () => {
    const resultado = liquidarLegajo({
      varsBase: { BASICO: 1000000 },
      conceptos, reglas,
      insumosDirectos: { SAC: 500000 },
    });

    const jubilacion = resultado.detalle.find((d) => d.conceptoCodigo === "JUBILACION");
    expect(jubilacion.importe).toBeCloseTo((1000000 + 500000) * 0.11, 2);
  });

  it("el bruto final incluye el SAC correctamente", () => {
    const resultado = liquidarLegajo({
      varsBase: { BASICO: 1000000 },
      conceptos, reglas,
      insumosDirectos: { SAC: 500000 },
    });
    expect(resultado.bruto).toBe(1500000);
  });

  it("sin ningún insumo directo, sigue funcionando igual que siempre (sin regresión)", () => {
    const resultado = liquidarLegajo({
      varsBase: { BASICO: 1000000 },
      conceptos, reglas,
      insumosDirectos: {},
    });
    const jubilacion = resultado.detalle.find((d) => d.conceptoCodigo === "JUBILACION");
    expect(jubilacion.importe).toBeCloseTo(1000000 * 0.11, 2);
    expect(resultado.bruto).toBe(1000000);
  });
});
