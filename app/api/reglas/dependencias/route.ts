// FM RRHH — app/api/reglas/dependencias/route.ts
// Arma, para una fórmula (guardada o todavía en edición), el panorama de
// dependencias: de qué depende (otros conceptos, variables base, funciones,
// topes) y quién depende de ÉL (otras reglas del mismo convenio que lo
// referencian vía CONCEPTO()). Solo lectura — no guarda ni calcula nada.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extraerDependencias, extraerVariablesBase, extraerFuncionesUsadas, extraerTopesReferenciados } from "@/lib/motor/motor-reglas.mjs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conceptoCodigo = searchParams.get("conceptoCodigo");
  const convenioId = searchParams.get("convenioId");
  const formula = searchParams.get("formula");

  if (!conceptoCodigo || !convenioId || !formula) {
    return NextResponse.json({ error: "Faltan conceptoCodigo, convenioId o formula." }, { status: 400 });
  }

  const dependeDe = extraerDependencias(formula);
  const variablesBase = extraerVariablesBase(formula);
  const funciones = extraerFuncionesUsadas(formula);
  const topes = extraerTopesReferenciados(formula);

  // "Es utilizado por" — todas las OTRAS reglas vigentes de este convenio
  // cuya fórmula referencia a este concepto vía CONCEPTO('conceptoCodigo').
  const otrasReglas = await prisma.reglaConcepto.findMany({
    where: { convenioId, vigenciaHasta: null, concepto: { codigo: { not: conceptoCodigo } } },
    include: { concepto: true },
  });
  const esUtilizadoPor = otrasReglas
    .filter((r) => extraerDependencias(r.formula).includes(conceptoCodigo))
    .map((r) => ({ codigo: r.concepto.codigo, nombre: r.concepto.nombre }));

  // Nombres legibles para los conceptos de los que depende (no solo el código)
  const conceptosDeDependencias = dependeDe.length
    ? await prisma.concepto.findMany({ where: { codigo: { in: dependeDe } } })
    : [];
  const dependeDeConNombre = dependeDe.map((codigo) => ({
    codigo,
    nombre: conceptosDeDependencias.find((c) => c.codigo === codigo)?.nombre ?? codigo,
  }));

  const concepto = await prisma.concepto.findUnique({ where: { codigo: conceptoCodigo } });

  return NextResponse.json({
    dependeDe: dependeDeConNombre,
    variablesBase,
    funciones,
    topes,
    esUtilizadoPor,
    // Adónde va a parar el importe de este concepto, en términos generales
    // (bruto/neto) — información real del sistema, no aspiracional (SAC,
    // vacaciones y F.931 todavía no consumen conceptos individuales de esta
    // forma trazable, así que no se muestra algo que no existe todavía).
    afecta: concepto?.tipo === "remunerativo" || concepto?.tipo === "no_remunerativo" ? "Bruto" : concepto?.tipo === "descuento" ? "Neto (resta)" : null,
  });
}
