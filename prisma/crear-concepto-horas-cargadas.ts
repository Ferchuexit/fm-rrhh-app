// FM RRHH — prisma/crear-concepto-horas-cargadas.ts
// Crea el concepto especial que permite cargar las horas REALES
// trabajadas por novedad, para que pisen la asunción genérica de 8hs/día
// en /api/liquidar — ver 63-novedades-horas-reales.md.
//
// A propósito NO es tipo remunerativo/no_remunerativo/descuento — es
// puramente un dato de entrada (cuántas horas), no un ítem de la
// liquidación con su propio importe. Por eso el tipo es "informativo": no
// coincide con ningún filtro de /api/recibo, así que nunca aparece como
// una línea del recibo — solo determina el valor de HORAS_TRABAJADAS.
import { PrismaClient } from "@prisma/client";
import { sugerirProximoNumero } from "../lib/motor/catalogo-conceptos.mjs";

const prisma = new PrismaClient();

async function main() {
  const existente = await prisma.concepto.findUnique({ where: { codigo: "HORAS_TRABAJADAS_CARGADAS" } });
  if (existente) { console.log("Ya existía — sin cambios."); return; }

  const rangos = await prisma.rangoNumeracion.findMany();
  const conceptosExistentes = await prisma.concepto.findMany();
  // No hay un rango configurado para "informativo" — no pasa nada, un
  // concepto sin número simplemente no se numera (no participa de LSD/F.931).
  const numero = sugerirProximoNumero("informativo", rangos, conceptosExistentes as any);

  await prisma.concepto.create({
    data: {
      codigo: "HORAS_TRABAJADAS_CARGADAS",
      nombre: "Horas trabajadas (cargadas por novedad)",
      tipo: "informativo",
      unidad: "horas",
      numero,
      categoriaNovedad: "Horas",
    },
  });
  console.log("✔ Concepto \"HORAS_TRABAJADAS_CARGADAS\" creado.");
  console.log("\nYa se puede cargar como novedad (categoría \"Horas\") — cuando exista para un legajo/período,");
  console.log("sus horas pisan la asunción de 8hs/día en /api/liquidar y en el recibo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
