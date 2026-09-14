// FM RRHH — tests/motor-docentes-pba.test.mjs
import { describe, it, expect } from "vitest";
import {
  calcularBasico,
  calcularBasicoHoraCatedra,
  buscarPorcentajeAntiguedad,
  buscarPorcentajeZona,
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

const TRAMOS_ZONA = [
  { nivel: 1, porcentaje: 30 },
  { nivel: 2, porcentaje: 60 },
  { nivel: 3, porcentaje: 90 },
  { nivel: 4, porcentaje: 100 },
  { nivel: 5, porcentaje: 120 },
];

const CONCEPTOS = [
  { codigo: "438", nombre: "BONIF. REMUN. DOCENTE 2014", modoCalculo: "fijo_por_unidad", aplicaANivel: "Primaria", aplicaACargoNombre: "Maestro de Grado", aportaAportes: true, valor: 278750.0 },
  { codigo: "455", nombre: "BONIF. REMUN. DOC. 08/2008", modoCalculo: "fijo_por_unidad", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: true, valor: 141881.0 },
  { codigo: "641", nombre: "BONIF. 1ER Y 2DO CICLO", modoCalculo: "fijo_por_unidad", aplicaANivel: "Primaria", aplicaACargoNombre: null, aportaAportes: true, valor: 234294.31 },
  { codigo: "2575", nombre: "Comp. FONID/Conectividad", modoCalculo: "fijo_por_unidad", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: false, valor: 30709.0 },
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
  it("641 en Maestro de Grado escala con las unidades reales, Preceptor queda fijo — Jornada Completa", () => {
    const concepto641 = CONCEPTOS.find((c) => c.codigo === "641");
    const paraMaestro = calcularImporteConcepto({ concepto: concepto641, basico: 769324.6, cargoNombre: "Maestro de Grado", unidadesCargo: 2 });
    const paraPreceptor = calcularImporteConcepto({ concepto: concepto641, basico: 699386, cargoNombre: "Preceptor", unidadesCargo: 2 });
    expect(paraMaestro).toBeCloseTo(468588.62, 1);
    expect(paraPreceptor).toBeCloseTo(234294.31, 1);
  });

  it("641 en Jornada Extendida (1,75 unidades) — Maestro escala, Preceptor sigue fijo", () => {
    const concepto641 = CONCEPTOS.find((c) => c.codigo === "641");
    const paraMaestro = calcularImporteConcepto({ concepto: concepto641, basico: 673159.03, cargoNombre: "Maestro de Grado", unidadesCargo: 1.75 });
    const paraPreceptor = calcularImporteConcepto({ concepto: concepto641, basico: 611962.75, cargoNombre: "Preceptor", unidadesCargo: 1.75 });
    expect(paraMaestro).toBeCloseTo(410015.04, 1);
    expect(paraPreceptor).toBeCloseTo(234294.31, 1); // idéntico a Jornada Completa — no escala nunca en Preceptor
  });
});

describe("calcularBasicoHoraCatedra", () => {
  it("Profesor, 4 horas cátedra", () => {
    expect(calcularBasicoHoraCatedra({ valorPorIndice: VALOR_INDICE, divisorHoraCatedra: 15, cantidadModulos: 4 })).toBeCloseTo(93251.47, 1);
  });
  it("Profesor, 8 horas cátedra (exactamente el doble)", () => {
    expect(calcularBasicoHoraCatedra({ valorPorIndice: VALOR_INDICE, divisorHoraCatedra: 15, cantidadModulos: 8 })).toBeCloseTo(186502.93, 1);
  });
});

describe("liquidarDesignacion — Profesor, hora cátedra (regresión contra recibos reales)", () => {
  const PROFESOR = { nombre: "Profesor", nivel: "Secundaria", modalidad: null, indice: 1, unidades: 1, tipo: "hora_catedra", divisorHoraCatedra: 15 };
  const CONCEPTOS_CON_667 = [
    ...CONCEPTOS,
    { codigo: "667", nombre: "B.R.N.B ap 1/3/14", modoCalculo: "porcentaje_basico", aplicaANivel: "Secundaria", aplicaACargoNombre: null, aportaAportes: true, valor: 43.5 },
  ];

  it("Profesor, 4 horas cátedra, 1 año de antigüedad", () => {
    const r = liquidarDesignacion({
      cargo: PROFESOR,
      valorPorIndice: VALOR_INDICE,
      aniosAntiguedad: 1,
      tramosAntiguedad: TRAMOS,
      conceptos: CONCEPTOS_CON_667,
      cantidadModulos: 4,
    });
    expect(r.basico).toBeCloseTo(93251.47, 1);
    expect(r.antiguedad).toBeCloseTo(19582.81, 1);
    expect(r.detalle.find((d) => d.codigo === "455").importe).toBeCloseTo(37834.93, 1); // escala con las horas, a diferencia de un 'cargo'
    expect(r.detalle.find((d) => d.codigo === "667").importe).toBeCloseTo(40564.39, 1);
    expect(r.detalle.find((d) => d.codigo === "641")).toBeUndefined(); // no aplica a Secundaria
    expect(r.detalle.find((d) => d.codigo === "438")).toBeUndefined(); // no aplica a Secundaria
  });

  it("Profesor, 8 horas cátedra — los montos fijos dan exactamente el doble que a 4 horas", () => {
    const r4 = liquidarDesignacion({ cargo: PROFESOR, valorPorIndice: VALOR_INDICE, aniosAntiguedad: 1, tramosAntiguedad: TRAMOS, conceptos: CONCEPTOS_CON_667, cantidadModulos: 4 });
    const r8 = liquidarDesignacion({ cargo: PROFESOR, valorPorIndice: VALOR_INDICE, aniosAntiguedad: 1, tramosAntiguedad: TRAMOS, conceptos: CONCEPTOS_CON_667, cantidadModulos: 8 });
    expect(r8.basico).toBeCloseTo(r4.basico * 2, 1);
    expect(r8.detalle.find((d) => d.codigo === "455").importe).toBeCloseTo(r4.detalle.find((d) => d.codigo === "455").importe * 2, 1);
  });
});

describe("liquidarDesignacion — Jornada Extendida (regresión contra recibos reales)", () => {
  const MAESTRO_JE = { nombre: "Maestro de Grado", nivel: "Primaria", modalidad: "Jornada Extendida/Doble Escolaridad - 6 hs", indice: 1.1, unidades: 1.75, tipo: "cargo" };
  const PRECEPTOR_JE = { nombre: "Preceptor", nivel: "Primaria", modalidad: "Jornada Extendida/Doble Escolaridad - 6 hs", indice: 1.0, unidades: 1.75, tipo: "cargo" };

  it("Maestro de Grado, Jornada Extendida, 2 años", () => {
    const r = liquidarDesignacion({ cargo: MAESTRO_JE, valorPorIndice: VALOR_INDICE, aniosAntiguedad: 2, tramosAntiguedad: TRAMOS, conceptos: CONCEPTOS });
    expect(r.basico).toBeCloseTo(673159.03, 1);
    expect(r.antiguedad).toBeCloseTo(161558.17, 1);
    expect(r.detalle.find((d) => d.codigo === "641").importe).toBeCloseTo(410015.04, 1);
    // Recibo real: $2.147.672,76 — incluye $260,52 de GARANTÍA no implementada.
    expect(r.totalHaberes).toBeCloseTo(2147412.24, 1);
  });

  it("Preceptor, Jornada Extendida, 2 años — 641 igual que en Jornada Completa", () => {
    const r = liquidarDesignacion({ cargo: PRECEPTOR_JE, valorPorIndice: VALOR_INDICE, aniosAntiguedad: 2, tramosAntiguedad: TRAMOS, conceptos: CONCEPTOS });
    expect(r.basico).toBeCloseTo(611962.75, 1);
    expect(r.detalle.find((d) => d.codigo === "641").importe).toBeCloseTo(234294.31, 1);
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

  it("sin zona desfavorable, no aparece el 624", () => {
    const r = liquidarDesignacion({ cargo: MAESTRO_JC, valorPorIndice: VALOR_INDICE, aniosAntiguedad: 2, tramosAntiguedad: TRAMOS, conceptos: CONCEPTOS });
    expect(r.detalle.find((d) => d.codigo === "624")).toBeUndefined();
  });
});

describe("buscarPorcentajeZona — tabla de 5 niveles", () => {
  it.each([
    [null, 0], [1, 30], [2, 60], [3, 90], [4, 100], [5, 120],
  ])("nivel %s da %i%%", (nivel, esperado) => {
    expect(buscarPorcentajeZona(nivel, TRAMOS_ZONA)).toBe(esperado);
  });
});

describe("liquidarDesignacion — zona desfavorable (regresión contra 5 recibos reales)", () => {
  it.each([
    [1, 230797.38],
    [2, 461594.76],
    [3, 692392.14],
    [4, 769324.6],
    [5, 923189.52],
  ])("Maestro de Grado, Jornada Completa, nivel %i de zona", (nivel, importeEsperado) => {
    const r = liquidarDesignacion({
      cargo: MAESTRO_JC,
      valorPorIndice: VALOR_INDICE,
      aniosAntiguedad: 2,
      tramosAntiguedad: TRAMOS,
      conceptos: CONCEPTOS,
      zonaDesfavorabilidad: nivel,
      tramosZona: TRAMOS_ZONA,
    });
    expect(r.detalle.find((d) => d.codigo === "624").importe).toBeCloseTo(importeEsperado, 1);
  });
});
