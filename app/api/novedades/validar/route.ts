// FM RRHH — app/api/novedades/validar/route.ts
// Arma el contexto real (legajos, conceptos, reglas por convenio, novedades
// ya cargadas) y llama a validarNovedades() — el mismo motor probado en
// test-validador-novedades.mjs, sin tocarlo. No persiste nada todavía: eso
// es responsabilidad de /api/novedades/confirmar, a propósito, para que el
// usuario pueda ver el resumen antes de que algo toque la base.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarNovedades } from "@/lib/motor/validador-novedades.mjs";

export async function POST(req: Request) {
  const { periodoId, filas } = await req.json();

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  const desde = periodo.fechaDesde;
  const hasta = periodo.fechaHasta;

  const legajosDb = await prisma.legajo.findMany({ where: { empresaId: periodo.empresaId } });
  const legajos = legajosDb.map((l) => ({
    numero: l.numeroLegajo,
    condicion: l.condicion,
    convenioId: l.convenioId,
    fechaEgreso: null, // no wireado en este schema reducido, ver 13-esqueleto-nextjs.md
  }));

  const conceptosDb = await prisma.concepto.findMany();
  const conceptos = conceptosDb.map((c) => ({ codigo: c.codigo, unidad: c.unidad }));

  const reglasDb = await prisma.reglaConcepto.findMany({ include: { concepto: true } });
  const reglasConvenioConcepto = new Set(reglasDb.map((r) => `${r.convenioId}|${r.concepto.codigo}`));

  // Los conceptos "insumo" (sin ninguna regla en NINGÚN convenio — ver
  // 02-motor-de-reglas.md) no tienen forma de expresar en este schema
  // reducido a qué convenios aplican, porque esa info viviría en una fórmula
  // que un insumo justamente no tiene. Simplificación explícita para este
  // anticipo: si un concepto no tiene regla en ningún lado, se trata como
  // válido para cualquier convenio. El catálogo de conceptos (12-catalogo-y-parametros.md)
  // ya prevé una columna "convenios donde aplica" para esto — falta una
  // tabla ConceptoConvenio real para que un insumo también pueda restringirse.
  const codigosConAlgunaRegla = new Set(reglasDb.map((r) => r.concepto.codigo));
  const conveniosDb = await prisma.convenio.findMany();
  for (const c of conceptosDb) {
    if (!codigosConAlgunaRegla.has(c.codigo)) {
      for (const conv of conveniosDb) reglasConvenioConcepto.add(`${conv.id}|${c.codigo}`);
    }
  }

  const novedadesExistentesDb = await prisma.novedad.findMany({
    where: { legajo: { empresaId: periodo.empresaId }, periodo: { gte: desde, lte: hasta }, estado: "valida" },
    include: { legajo: true, concepto: true },
  });
  const novedadesExistentes = novedadesExistentesDb.map((n) => ({
    legajoNumero: n.legajo.numeroLegajo,
    conceptoCodigo: n.concepto.codigo,
    fecha: n.periodo.toISOString().slice(0, 10),
  }));

  const resultado = validarNovedades(filas, {
    legajos,
    conceptos,
    reglasConvenioConcepto,
    periodo: { desde, hasta },
    novedadesExistentes,
  });

  return NextResponse.json(resultado);
}
