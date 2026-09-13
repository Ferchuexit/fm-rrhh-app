// FM RRHH — tests/motor-docentes-pba.test.mjs
import { describe, it, expect } from "vitest";
import {
  calcularBasico,
  buscarPorcentajeAntiguedad,
  calcularAntiguedad,
  calcularImporteConcepto,
  calcularAportes,
  liquidarDesignacion,
} from "../lib/motor/motor-docentes-pba.mjs";

const VALOR_INDICE = 349693.0; // vigente desde 01/08/2026

const TRAMOS = [
  { aniosDesde: 0, porcentaje: 0 },
  { aniosDesde: 1, porcentaje: 21 },
  { aniosDesde: 2, porcentaje: 24 },
  { aniosDesde: 4, porcentaje: 33 },
  { aniosDesde: 7, porcentaje: 43 },
  { aniosDesde: 10, porcentaje: 54 },
  { aniosDesde: 12, porcentaje: 64 },
  { aniosDesde: 15, porcentaje: 74 },
  { aniosDesde: 17, porcentaje: 84 },
  { aniosDesde: 20, porcentaje: 105 },
  { aniosDesde: 22, porcentaje: 115 },
  { aniosDesde: 24, porcentaje: 125 },
];

const CONCEPTOS = [
  { codigo: "438", nombre: "BONIF. REMUN. DOCENTE 2014", modoCalculo: "fijo_por_unidad", aplicaANivel: "Primaria", aplicaACargoNombre: "Maestro de Grado", aportaAportes: true, valor: 557500.0 },
  { codigo: "455", nombre: "BONIF. REMUN. DOC. 08/2008", modoCalculo: "fijo_por_unidad", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: true, valor: 283762.0 },
  { codigo: "641", nombre: "BONIF. 1ER Y 2DO CICLO", modoCalculo: "fijo_por_unidad", aplicaANivel: "Primaria", aplicaACargoNombre: null, aportaAportes: true, valor: 234294.31 },
  { codigo: "2575", nombre: "Comp. FONID/Conectividad", modoCalculo: "fijo_por_unidad", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: false, valor: 61418.0 },
  { codigo: "624", nombre: "RURAL", modoCalculo: "porcentaje_basico", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: true, valor: 30.0 },
];

const MAESTRO_JC = { nombre: "Maestro de Grado", nivel: "Primaria", modalidad: "Jornada Completa - 8 hs", indice: 1.1, unidades: 2, tipo: "cargo" };
const PRECEPTOR_JC = { nombre: "Preceptor", nivel: "Primaria", modalidad: "Jornada Completa - 8 hs", indice: 1.0, unidades: 2, tipo: "cargo" };

describe("calcularBasico", () => {
  it("Maestro de Grado, Jornada Completa: índice 1,10 × unidades 2", () => {
    expect(calcularBasico({ indice: 1.1, valorPorIndice: VALOR_INDICE, unidades: 2 })).toBeCloseTo(769324.6, 2);
  });
  it("Preceptor, Jornada Completa: índice 1,00 (cargo testigo) × unidades 2", () => {
    expect(calcularBasico({ indice: 1.0, valorPorIndice: VALOR_INDICE, unidades: 2 })).toBeCloseTo(699386.0, 2);
  });
  it("Maestro de Grado, Jornada Extendida (1,75 unidades)", () => {
    expect(calcularBasico({ indice: 1.1, valorPorIndice: VALOR_INDICE, unidades: 1.75 })).toBeCloseTo(673159.03, 1);
  });
});

describe("buscarPorcentajeAntiguedad", () => {
  it.each([
    [0, 0], [1, 21], [2, 24], [3, 24], [4, 33], [6, 33], [7, 43],
    [10, 54], [12, 64], [15, 74], [17, 84], [20, 105], [22, 115], [24, 125], [30, 125],
  ])("con %i años de antigüedad da %i%%", (anios, esperado) => {
    expect(buscarPorcentajeAntiguedad(anios, TRAMOS)).toBe(esperado);
  });
});

describe("calcularAntiguedad", () => {
  it("2 años sobre el básico de Maestro de Grado Jornada Completa", () => {
    expect(calcularAntiguedad({ basico: 769324.6, aniosAntiguedad: 2, tramos: TRAMOS })).toBeCloseTo(184637.9, 1);
  });
  it("1 año sobre el básico de Preceptor Jornada Completa", () => {
    expect(calcularAntiguedad({ basico: 699386, aniosAntiguedad: 1, tramos: TRAMOS })).toBeCloseTo(146871.06, 1);
  });
});

describe("calcularImporteConcepto — el caso especial de 641", () => {
  it("641 en Maestro de Grado paga el doble que en Preceptor (confirmado con 4 casos reales)", () => {
    const concepto641 = CONCEPTOS.find((c) => c.codigo === "641");
    const paraMaestro = calcularImporteConcepto({ concepto: concepto641, basico: 769324.6, cargoNombre: "Maestro de Grado" });
    const paraPreceptor = calcularImporteConcepto({ concepto: concepto641, basico: 699386, cargoNombre: "Preceptor" });
    expect(paraMaestro).toBeCloseTo(468588.62, 1);
    expect(paraPreceptor).toBeCloseTo(234294.31, 1);
  });
});

describe("calcularAportes", () => {
  it("IPS 16% e IOMA 4,8% sobre la base confirmada del caso Maestro 2 años", () => {
    const { ips, ioma } = calcularAportes(2263813.12);
    expect(ips).toBeCloseTo(362210.1, 1);
    expect(ioma).toBeCloseTo(108663.03, 1);
  });
});

describe("liquidarDesignacion — casos reales completos (regresión contra recibos de FEB)", () => {
  it("Maestro de Grado, Jornada Completa, 2 años de antigüedad", () => {
    const r = liquidarDesignacion({
      cargo: MAESTRO_JC,
      valorPorIndice: VALOR_INDICE,
      aniosAntiguedad: 2,
      tramosAntiguedad: TRAMOS,
      conceptos: CONCEPTOS,
      zonaRural: false,
    });
    expect(r.basico).toBeCloseTo(769324.6, 1);
    expect(r.antiguedad).toBeCloseTo(184637.9, 1);
    // El recibo real de FEB da $2.325.491,64 — incluye $260,52 de
    // "GARANTIA MAR/2007" que a propósito NO implementamos (ver
    // comentario de alcance arriba del archivo). Sin GARANTÍA: $2.325.231,12.
    expect(r.totalHaberes).toBeCloseTo(2325231.12, 1);
    expect(r.ips).toBeCloseTo(362210.1, 1);
    expect(r.ioma).toBeCloseTo(108663.03, 1);
    expect(r.totalDescuentos).toBeCloseTo(470873.13, 1);
    expect(r.neto).toBeCloseTo(1854357.99, 1); // real $1.854.618,51 menos GARANTÍA no implementada
  });

  it("Preceptor, Jornada Completa, 1 año de antigüedad — sin 438 (no le corresponde)", () => {
    const r = liquidarDesignacion({
      cargo: PRECEPTOR_JC,
      valorPorIndice: VALOR_INDICE,
      aniosAntiguedad: 1,
      tramosAntiguedad: TRAMOS,
      conceptos: CONCEPTOS,
      zonaRural: false,
    });
    expect(r.basico).toBeCloseTo(699386.0, 1);
    expect(r.antiguedad).toBeCloseTo(146871.06, 1);
    expect(r.detalle.find((d) => d.codigo === "438")).toBeUndefined();
    // Recibo real: $1.426.441,46 — incluye $507,54 (GARANTIA MAR/2007) +
    // $202,55 (GARANTIA 730) que a propósito no implementamos. Sin
    // GARANTÍA: $1.425.731,37.
    expect(r.totalHaberes).toBeCloseTo(1425731.37, 1);
    // La GARANTÍA también entra en la base de aportes — por eso el IPS
    // real ($218.322,55) es $32,41 más alto que el nuestro (sin GARANTÍA
    // implementada, $202,55 × 16% = $32,41 exacto). Mismo caso para IOMA.
    expect(r.ips).toBeCloseTo(218290.14, 1);
    expect(r.ioma).toBeCloseTo(65487.04, 1);
    expect(r.neto).toBeCloseTo(1141954.19, 1); // real $1.142.622,15 menos GARANTÍA (haber + su aporte)
  });

  it("RURAL solo se aplica si zonaRural=true", () => {
    const sinRural = liquidarDesignacion({ cargo: MAESTRO_JC, valorPorIndice: VALOR_INDICE, aniosAntiguedad: 2, tramosAntiguedad: TRAMOS, conceptos: CONCEPTOS, zonaRural: false });
    const conRural = liquidarDesignacion({ cargo: MAESTRO_JC, valorPorIndice: VALOR_INDICE, aniosAntiguedad: 2, tramosAntiguedad: TRAMOS, conceptos: CONCEPTOS, zonaRural: true });
    expect(sinRural.detalle.find((d) => d.codigo === "624")).toBeUndefined();
    const rural = conRural.detalle.find((d) => d.codigo === "624");
    expect(rural.importe).toBeCloseTo(769324.6 * 0.3, 1);
  });
});
