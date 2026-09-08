// FM RRHH — prisma/cargar-valor-concepto-categoria.ts
//
// Plantilla para cargar el valor de un concepto que se liquida
// "VALOR_CATEGORIA('código') * CANTIDAD()" — un monto que varía según la
// categoría del convenio, multiplicado por una cantidad que se carga como
// novedad (horas trabajadas, unidades producidas, lo que corresponda).
//
// Se reutiliza cada vez que se agregue un concepto nuevo de este tipo —
// completá CONCEPTO_CODIGO y la lista de VALORES, y corré el script.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Completar antes de correr ──
const CONCEPTO_CODIGO = "CAMBIAR_ESTO"; // el codigo interno del concepto (no el número), ej. "PREMIO_PRODUCCION"
const CONVENIO_CODIGO = "0335/75"; // a qué convenio pertenecen las categorías de abajo
const VIGENCIA_DESDE = new Date("2026-01-01");

const VALORES: { categoria: string; valor: number }[] = [
  // { categoria: "OFICIAL MULTIPLE", valor: 0 },
  // { categoria: "OFICIAL ESPECIALIZADO", valor: 0 },
  // ...una fila por categoría que necesite un valor distinto.
];

async function main() {
  if (CONCEPTO_CODIGO === "CAMBIAR_ESTO" || VALORES.length === 0) {
    console.log("⚠ Completá CONCEPTO_CODIGO y la lista VALORES en este archivo antes de correrlo.");
    return;
  }

  const concepto = await prisma.concepto.findUnique({ where: { codigo: CONCEPTO_CODIGO } });
  if (!concepto) { console.log(`No existe ningún concepto con código "${CONCEPTO_CODIGO}" — creálo primero en /conceptos.`); return; }

  const convenio = await prisma.convenio.findUnique({ where: { codigo: CONVENIO_CODIGO } });
  if (!convenio) { console.log(`No existe el convenio "${CONVENIO_CODIGO}".`); return; }

  let creados = 0, actualizados = 0, sinCategoria = 0;

  for (const v of VALORES) {
    const categoria = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, nombre: v.categoria } });
    if (!categoria) { console.log(`⚠ Categoría "${v.categoria}" no existe en ${CONVENIO_CODIGO} — se salta.`); sinCategoria++; continue; }

    const existente = await prisma.valorConceptoCategoria.findFirst({
      where: { conceptoId: concepto.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_DESDE },
    });

    if (existente) {
      if (existente.valor === v.valor) continue;
      await prisma.valorConceptoCategoria.update({ where: { id: existente.id }, data: { valor: v.valor } });
      actualizados++;
      console.log(`✔ "${v.categoria}": actualizado a $${v.valor}`);
    } else {
      await prisma.valorConceptoCategoria.create({
        data: { conceptoId: concepto.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_DESDE, valor: v.valor },
      });
      creados++;
      console.log(`✔ "${v.categoria}": $${v.valor}`);
    }
  }

  console.log(`\n${creados} creados, ${actualizados} actualizados, ${sinCategoria} saltados por categoría inexistente.`);
  console.log(`\nRecordá que la fórmula del concepto (en /reglas o por script) tiene que usar:`);
  console.log(`  VALOR_CATEGORIA('${CONCEPTO_CODIGO}') * CANTIDAD()`);
  console.log(`Y que la CANTIDAD tiene que cargarse como novedad de este concepto, por legajo y período.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
