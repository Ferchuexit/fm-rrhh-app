// FM RRHH — lib/plantillas-formula.ts
// Biblioteca de fórmulas prearmadas para /reglas — no son ejemplos
// genéricos de tutorial, son los patrones que ya se construyeron y
// validaron en este mismo proyecto (Presentismo/Antigüedad de Comercio,
// los 4 descuentos de Madera, el valor por categoría). Elegís una,
// completás los campos, se genera la fórmula sola.
export interface CampoPlantilla {
  key: string;
  label: string;
  tipo: "concepto" | "numero" | "texto";
  placeholder?: string;
}

export interface PlantillaFormula {
  id: string;
  nombre: string;
  descripcion: string;
  patron: string; // para mostrar antes de completar, con los {campos} a la vista
  campos: CampoPlantilla[];
  generar: (v: Record<string, string>) => string;
}

export const PLANTILLAS: PlantillaFormula[] = [
  {
    id: "porcentaje_concepto",
    nombre: "Porcentaje sobre un concepto",
    descripcion: "Un porcentaje fijo de otro concepto ya calculado.",
    patron: "CONCEPTO('base') * porcentaje",
    campos: [
      { key: "base", label: "Concepto base", tipo: "concepto" },
      { key: "porcentaje", label: "Porcentaje (0.05 = 5%)", tipo: "numero", placeholder: "0.05" },
    ],
    generar: (v) => `CONCEPTO('${v.base}') * ${v.porcentaje || 0}`,
  },
  {
    id: "antiguedad",
    nombre: "Antigüedad (X% por año)",
    descripcion: "El patrón real de Comercio y Madera: básico × años de antigüedad × porcentaje por año.",
    patron: "BASICO * ANTIGUEDAD_ANIOS * porcentaje",
    campos: [{ key: "porcentaje", label: "Porcentaje por año (0.01 = 1%)", tipo: "numero", placeholder: "0.01" }],
    generar: (v) => `BASICO * ANTIGUEDAD_ANIOS * ${v.porcentaje || 0}`,
  },
  {
    id: "porcentaje_suma_dos",
    nombre: "Porcentaje sobre dos conceptos sumados",
    descripcion: "El patrón real de Presentismo de Comercio: (básico + antigüedad) × porcentaje.",
    patron: "(CONCEPTO('base1') + CONCEPTO('base2')) * porcentaje",
    campos: [
      { key: "base1", label: "Primer concepto", tipo: "concepto" },
      { key: "base2", label: "Segundo concepto", tipo: "concepto" },
      { key: "porcentaje", label: "Porcentaje (0.0833 = 8,33%)", tipo: "numero", placeholder: "0.0833" },
    ],
    generar: (v) => `(CONCEPTO('${v.base1}') + CONCEPTO('${v.base2}')) * ${v.porcentaje || 0}`,
  },
  {
    id: "descuento_bruto",
    nombre: "Descuento sobre remunerativo + no remunerativo",
    descripcion: "El patrón real de Obra Social y Sindicato de Madera — usa REM_TOTAL()/NOREM_TOTAL(), solo sirve para conceptos de tipo descuento.",
    patron: "(REM_TOTAL() + NOREM_TOTAL()) * porcentaje",
    campos: [{ key: "porcentaje", label: "Porcentaje (0.03 = 3%)", tipo: "numero", placeholder: "0.03" }],
    generar: (v) => `(REM_TOTAL() + NOREM_TOTAL()) * ${v.porcentaje || 0}`,
  },
  {
    id: "descuento_remunerativo",
    nombre: "Descuento solo sobre remunerativo",
    descripcion: "El patrón real de Jubilación y Ley 19.032 de Madera — solo sirve para conceptos de tipo descuento.",
    patron: "REM_TOTAL() * porcentaje",
    campos: [{ key: "porcentaje", label: "Porcentaje (0.11 = 11%)", tipo: "numero", placeholder: "0.11" }],
    generar: (v) => `REM_TOTAL() * ${v.porcentaje || 0}`,
  },
  {
    id: "valor_hora",
    nombre: "Básico por hora (valor hora × horas trabajadas)",
    descripcion: "El patrón real del básico de Madera — convenios que liquidan por hora, no mensual fijo.",
    patron: "VALOR_HORA * HORAS_TRABAJADAS",
    campos: [],
    generar: () => `VALOR_HORA * HORAS_TRABAJADAS`,
  },
  {
    id: "valor_categoria_cantidad",
    nombre: "Valor por categoría × cantidad cargada",
    descripcion: "Para conceptos con un monto distinto según la categoría, multiplicado por una cantidad que se carga como novedad (horas, unidades, lo que sea).",
    patron: "VALOR_CATEGORIA('este_concepto') * CANTIDAD()",
    campos: [{ key: "codigoConcepto", label: "Código de este mismo concepto", tipo: "texto", placeholder: "ej. PREMIO_PRODUCCION" }],
    generar: (v) => `VALOR_CATEGORIA('${v.codigoConcepto}') * CANTIDAD()`,
  },
  {
    id: "topado",
    nombre: "Concepto con tope",
    descripcion: "El valor de otro concepto, pero sin superar un tope cargado en Parámetros.",
    patron: "MIN(CONCEPTO('base'), TOPE('clave'))",
    campos: [
      { key: "base", label: "Concepto base", tipo: "concepto" },
      { key: "clave", label: "Clave del tope (en /parametros)", tipo: "texto", placeholder: "ej. TOPE_JUBILATORIO" },
    ],
    generar: (v) => `MIN(CONCEPTO('${v.base}'), TOPE('${v.clave}'))`,
  },
  {
    id: "monto_fijo",
    nombre: "Monto fijo",
    descripcion: "El patrón real del Seguro Mercantil de Comercio — un valor que no depende de nada, siempre el mismo.",
    patron: "monto",
    campos: [{ key: "monto", label: "Monto", tipo: "numero", placeholder: "4" }],
    generar: (v) => `${v.monto || 0}`,
  },
];
