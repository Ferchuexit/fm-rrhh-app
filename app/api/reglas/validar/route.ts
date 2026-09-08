// FM RRHH — app/api/reglas/validar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarReglaAntesDeGuardar } from "@/lib/motor/validador-reglas.mjs";

export async function POST(req: Request) {
  const { conceptoCodigo, convenioId, formula } = await req.json();

  const reglasDb = await prisma.reglaConcepto.findMany({
    where: { vigenciaHasta: null },
    include: { concepto: true },
  });
  const reglasExistentes = reglasDb.map((r) => ({
    conceptoCodigo: r.concepto.codigo,
    convenioId: r.convenioId,
    formula: r.formula,
  }));

  const conceptosCatalogo = await prisma.concepto.findMany();

  const codigosConAlgunaRegla = new Set(reglasDb.map((r) => r.concepto.codigo));
  const insumosDirectos = conceptosCatalogo.filter((c) => !codigosConAlgunaRegla.has(c.codigo)).map((c) => c.codigo);

  const parametros = await prisma.parametroVigente.findMany();
  const clavesTopesConocidas = [...new Set(parametros.map((p) => p.clave))];

  const resultado = validarReglaAntesDeGuardar(
    { conceptoCodigo, convenioId, formula },
    reglasExistentes,
    conceptosCatalogo,
    insumosDirectos,
    clavesTopesConocidas
  );

  return NextResponse.json(resultado);
}
