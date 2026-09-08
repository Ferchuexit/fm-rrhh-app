// FM RRHH — prisma/crear-redondeo.ts
// Redondeo del neto a un número entero, para todos los convenios y
// categorías — usa NETO(), la función nueva del motor que solo está
// disponible en la "etapa 3" (después de calcular remunerativos, no
// remunerativos, Y descuentos). Ver 53-recibo-completo-comercio.md para
// la explicación completa de por qué esto necesitó un cambio real en el
// motor, y las pruebas que se corrieron antes de tocar la base.
import { PrismaClient } from "@prisma/client";
import { sugerirProximoNumero } from "../lib/motor/catalogo-conceptos.mjs";

const prisma = new PrismaClient();
const VIGENCIA_DESDE = new Date("2026-01-01");
const FORMULA_REDONDEO = "ROUND(NETO()) - NETO()";

async function main() {
  let concepto = await prisma.concepto.findUnique({ where: { codigo: "REDONDEO" } });
  if (!concepto) {
    const rangos = await prisma.rangoNumeracion.findMany();
    const conceptosExistentes = await prisma.concepto.findMany();
    const numero = sugerirProximoNumero("no_remunerativo", rangos, conceptosExistentes as any);
    concepto = await prisma.concepto.create({
      data: { codigo: "REDONDEO", nombre: "Redondeo", tipo: "no_remunerativo", unidad: "monto", numero, categoriaNovedad: "Otros" },
    });
    console.log(`✔ Concepto "REDONDEO" creado (número ${numero}).`);
  } else {
    console.log('El concepto "REDONDEO" ya existía.');
  }

  const convenios = await prisma.convenio.findMany();
  for (const conv of convenios) {
    const existente = await prisma.reglaConcepto.findFirst({ where: { conceptoId: concepto.id, convenioId: conv.id, vigenciaHasta: null } });
    if (existente) {
      console.log(`"${conv.codigo}": Redondeo ya estaba cargado — sin cambios.`);
      continue;
    }
    await prisma.reglaConcepto.create({
      data: { conceptoId: concepto.id, convenioId: conv.id, vigenciaDesde: VIGENCIA_DESDE, formula: FORMULA_REDONDEO, aporta: false, contribuye: false },
    });
    console.log(`✔ Redondeo cargado para "${conv.codigo}".`);
  }

  console.log("\nListo. El neto de cualquier legajo liquidado de acá en adelante va a dar en un número entero.");
  console.log("Volvé a liquidar los períodos ya calculados para que el redondeo se aplique retroactivamente.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
