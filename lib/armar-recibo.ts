// FM RRHH — lib/armar-recibo.ts
// Arma los datos de UN recibo (legajo + período) — extraído de
// /api/recibo para que la descarga individual y la descarga masiva
// (/api/recibos/exportar) usen exactamente la misma lógica, sin
// duplicarla en dos lugares que puedan desincronizarse con el tiempo.
import { prisma } from "@/lib/prisma";
import type { DatosRecibo, HaberRecibo, DeduccionRecibo, ContribucionRecibo } from "@/lib/recibo-pdf";
import { extraerVariablesBase } from "@/lib/motor/motor-reglas.mjs";
import { calcularAntiguedadAnios } from "@/lib/vacaciones";

function fechaDDMMAAAA(d: Date) {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function extraerCantidadDisplay(formula: string, valores: { horas: number; dias: number; anios: number }): string {
  const vars = extraerVariablesBase(formula);
  if (vars.includes("HORAS_TRABAJADAS")) return `${valores.horas} horas`;
  if (vars.includes("ANTIGUEDAD_ANIOS")) return `${valores.anios} años`;
  if (vars.includes("DIAS_TRABAJADOS") || vars.includes("DIAS_MES")) return `${valores.dias} días`;
  return "";
}

function formatearPct(numero: number): string {
  const pct = numero * 100;
  const texto = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${texto.replace(".", ",")}%`;
}

function extraerPorcentajeDisplay(formula: string, contexto?: { afiliadoSindicato?: boolean }): string {
  const matchCondicional = formula.match(/IF\(\s*AFILIADO_SINDICATO\s*==\s*1\s*,.*?\*\s*(0\.\d+).*?,.*?\*\s*(0\.\d+)\s*\)/);
  if (matchCondicional && contexto?.afiliadoSindicato !== undefined) {
    const numero = contexto.afiliadoSindicato ? parseFloat(matchCondicional[1]) : parseFloat(matchCondicional[2]);
    if (!isNaN(numero)) return formatearPct(numero);
  }

  const match = formula.match(/\*\s*(0\.\d+)(?!\d)/g);
  if (!match) return "";
  const ultimo = match[match.length - 1];
  const numero = parseFloat(ultimo.replace("*", "").trim());
  if (isNaN(numero)) return "";
  return formatearPct(numero);
}

// Devuelve null si el legajo no está liquidado en ese período — el que
// llama decide qué hacer (404 para uno solo, saltar en un lote).
export async function armarDatosRecibo(legajoId: string, periodoId: string): Promise<DatosRecibo | null> {
  // Con el versionado (Liquidacion.version), periodoId+legajoId YA NO ES
  // ÚNICO por sí solo — puede haber varias versiones (una por corrección).
  // La clave única real ahora es periodoId+legajoId+version, así que acá
  // hay que pedir la VIGENTE con findFirst, no buscar por una clave única
  // de 2 campos que ya no existe.
  const liquidacion = await prisma.liquidacion.findFirst({
    where: { periodoId, legajoId, vigente: true },
    include: {
      detalle: { include: { concepto: true } },
      legajo: { include: { categoria: true, convenio: true } },
      periodo: true,
    },
  });
  if (!liquidacion) return null;

  const { legajo, periodo, detalle } = liquidacion;
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: periodo.empresaId } });

  const reglas = await prisma.reglaConcepto.findMany({
    where: {
      convenioId: legajo.convenioId,
      vigenciaDesde: { lte: periodo.fechaDesde },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: periodo.fechaDesde } }],
    },
  });
  const formulaPorConceptoId = new Map(reglas.map((r) => [r.conceptoId, r.formula]));

  const antiguedadAnios = Math.floor(calcularAntiguedadAnios(legajo.fechaIngreso, legajo.antiguedadReconocida, periodo.fechaDesde));
  const diasDelPeriodo = Math.round((periodo.fechaHasta.getTime() - periodo.fechaDesde.getTime()) / (24 * 3600 * 1000)) + 1;

  const novedadesHoras = await prisma.novedad.findMany({
    where: { legajoId, periodo: { gte: periodo.fechaDesde, lte: periodo.fechaHasta }, estado: "valida", concepto: { codigo: "HS_NORMALES" } },
  });
  const horasReales = novedadesHoras.length > 0 ? novedadesHoras.reduce((a, n) => a + (n.cantidad ?? 0), 0) : diasDelPeriodo * 8;

  const esOpcionalConCantidadPropia = (formula: string | undefined) => formula != null && /\bCANTIDAD\(\s*\)/.test(formula);

  const haberes: HaberRecibo[] = detalle
    .filter((d) => d.concepto.tipo === "remunerativo" || d.concepto.tipo === "no_remunerativo")
    .filter((d) => {
      const formula = formulaPorConceptoId.get(d.conceptoId);
      return !(d.importe === 0 && esOpcionalConCantidadPropia(formula));
    })
    .map((d) => {
      const formula = formulaPorConceptoId.get(d.conceptoId);
      let cant = formula
        ? extraerCantidadDisplay(formula, { horas: horasReales, dias: diasDelPeriodo, anios: antiguedadAnios })
        : "";
      if (!cant && formula) cant = extraerPorcentajeDisplay(formula);
      return {
        codigo: d.concepto.numero != null ? String(d.concepto.numero) : "",
        nombre: d.concepto.nombre,
        cant,
        tipo: d.concepto.tipo as "remunerativo" | "no_remunerativo",
        importe: d.importe,
      };
    });

  const deducciones: DeduccionRecibo[] = detalle
    .filter((d) => d.concepto.tipo === "descuento")
    .map((d) => {
      const formula = formulaPorConceptoId.get(d.conceptoId);
      return {
        codigo: d.concepto.numero != null ? String(d.concepto.numero) : "",
        nombre: d.concepto.nombre,
        pct: formula ? extraerPorcentajeDisplay(formula, { afiliadoSindicato: legajo.afiliadoSindicato }) : "",
        importe: d.importe,
        rubro: (d.concepto as any).rubro ?? undefined,
      };
    });

  const contribuciones: ContribucionRecibo[] = detalle
    .filter((d) => d.concepto.tipo === "contribucion_patronal")
    .map((d) => ({
      nombre: d.concepto.nombre,
      base: liquidacion.bruto,
      importe: d.importe,
      rubro: (d.concepto as any).rubro ?? "otros",
    }));

  return {
    empresa: { razonSocial: empresa.razonSocial, cuit: empresa.cuit, domicilio: empresa.domicilio ?? "" },
    legajo: {
      numero: legajo.numeroLegajo,
      apellido: legajo.apellido,
      nombre: legajo.nombre,
      cuil: legajo.cuil,
      categoria: legajo.categoria.nombre,
      convenio: `CCT ${legajo.convenio.codigo}`,
      antiguedadAnios,
      fechaIngreso: fechaDDMMAAAA(legajo.fechaIngreso),
      obraSocial: legajo.obraSocialId ?? "",
      banco: legajo.bancoId ?? "",
    },
    periodo: { etiqueta: periodo.nombre, fechaPago: fechaDDMMAAAA(periodo.fechaPago ?? periodo.fechaHasta) },
    haberes,
    deducciones,
    contribuciones,
  };
}
