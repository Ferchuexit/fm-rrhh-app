// FM RRHH — app/api/reglas/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarReglaAntesDeGuardar } from "@/lib/motor/validador-reglas.mjs";

// SAC, Retención de Ganancias y Embargos NO pueden tener una ReglaConcepto
// — tienen código dedicado (lib/liquidacion-individual-recalculo.ts y
// app/api/liquidar/route.ts) que lee tablas propias (CuotaEmbargo,
// TablaGananciasMensual...) y maneja prioridad/topes entre conceptos. Si
// alguno de estos tiene una fórmula acá, esa lógica dedicada deja de
// aplicarse correctamente — encontrado en producción el 08/09/2026 al
// probar embargos en el legajo 9007: la fórmula se guardaba sin aviso y
// rompía el cálculo real de embargos.
const CODIGOS_SIN_FORMULA = ["SAC", "SAC_PROPORCIONAL", "RETENCION_GANANCIAS", "EMBARGO_JUDICIAL", "EMBARGO_COMERCIAL"];

export async function GET() {
  const reglas = await prisma.reglaConcepto.findMany({
    where: { vigenciaHasta: null },
    include: { concepto: true, convenio: true },
    orderBy: { vigenciaDesde: "desc" },
  });
  return NextResponse.json(reglas);
}

export async function POST(req: Request) {
  const { conceptoCodigo, convenioId, formula, aporta, contribuye, vigenciaDesde: vigenciaDesdeStr } = await req.json();

  if (CODIGOS_SIN_FORMULA.includes(conceptoCodigo)) {
    return NextResponse.json(
      {
        error: `"${conceptoCodigo}" no puede tener una fórmula acá`,
        detalle: [
          {
            mensaje:
              "SAC, Retención de Ganancias y Embargos se calculan con código dedicado (leen tablas propias como CuotaEmbargo, manejan prioridad y topes entre conceptos) — una fórmula acá entraría en conflicto y el cálculo real dejaría de aplicarse correctamente.",
          },
        ],
      },
      { status: 409 }
    );
  }

  // Nunca confiar solo en que el cliente ya validó — una regla mal cargada
  // puede romper la liquidación de todos los legajos de un convenio, no es
  // un dato de bajo riesgo como una novedad individual. Se revalida acá.
  const reglasDb = await prisma.reglaConcepto.findMany({ where: { vigenciaHasta: null }, include: { concepto: true } });
  const reglasExistentes = reglasDb.map((r) => ({ conceptoCodigo: r.concepto.codigo, convenioId: r.convenioId, formula: r.formula }));
  const conceptosCatalogo = await prisma.concepto.findMany();
  const codigosConAlgunaRegla = new Set(reglasDb.map((r) => r.concepto.codigo));
  const insumosDirectos = conceptosCatalogo.filter((c) => !codigosConAlgunaRegla.has(c.codigo)).map((c) => c.codigo);
  const parametros = await prisma.parametroVigente.findMany();
  const clavesTopesConocidas = [...new Set(parametros.map((p) => p.clave))];

  const validacion = validarReglaAntesDeGuardar(
    { conceptoCodigo, convenioId, formula },
    reglasExistentes,
    conceptosCatalogo,
    insumosDirectos,
    clavesTopesConocidas
  );
  if (!validacion.ok) {
    return NextResponse.json({ error: "Regla inválida", detalle: validacion.errores }, { status: 400 });
  }

  const concepto = await prisma.concepto.findUnique({ where: { codigo: conceptoCodigo } });
  if (!concepto) return NextResponse.json({ error: `Concepto "${conceptoCodigo}" no existe en el catálogo — creálo primero en /conceptos.` }, { status: 400 });

  // Versionado por vigencia — mismo patrón que actualizarParametro() en
  // parametros-topes.mjs: no se pisa la regla vieja, se cierra su vigencia.
  const vigenciaDesde = vigenciaDesdeStr ? new Date(vigenciaDesdeStr) : new Date();
  const vigenteActual = await prisma.reglaConcepto.findFirst({
    where: { conceptoId: concepto.id, convenioId, vigenciaHasta: null },
  });
  if (vigenteActual) {
    const cierre = new Date(vigenciaDesde);
    cierre.setDate(cierre.getDate() - 1);
    await prisma.reglaConcepto.update({ where: { id: vigenteActual.id }, data: { vigenciaHasta: cierre } });
  }

  const nueva = await prisma.reglaConcepto.create({
    data: { conceptoId: concepto.id, convenioId, vigenciaDesde, formula, aporta: !!aporta, contribuye: !!contribuye },
  });

  return NextResponse.json({ ok: true, regla: nueva, ordenResultante: validacion.ordenResultante });
}
