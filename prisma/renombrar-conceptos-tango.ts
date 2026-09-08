// FM RRHH — prisma/renombrar-conceptos-tango.ts
// Renombra los códigos de los conceptos horarios de Madera para que se
// parezcan a Tango, y actualiza las fórmulas que los referencian por
// nombre — ver 69-nombres-tango.md.
//
//   HORAS_TRABAJADAS_CARGADAS -> HS_NORMALES
//   ENFERMEDADES              -> HS_ENFERMEDAD
//   HS_ACCIDENTE              -> HS_ART
//
// No se pierde ningún dato — se renombra el Concepto existente (mismo id,
// mismo historial de novedades y detalle de liquidaciones ya guardadas),
// y se reescriben las fórmulas de otros conceptos que lo mencionan por
// código (CONCEPTO()/CANTIDAD()).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RENOMBRES: Record<string, string> = {
  HORAS_TRABAJADAS_CARGADAS: "HS_NORMALES",
  ENFERMEDADES: "HS_ENFERMEDAD",
  HS_ACCIDENTE: "HS_ART",
};

async function main() {
  // 1. Renombrar los conceptos mismos
  for (const [viejo, nuevo] of Object.entries(RENOMBRES)) {
    const concepto = await prisma.concepto.findUnique({ where: { codigo: viejo } });
    if (!concepto) { console.log(`"${viejo}" no existe — se salta.`); continue; }
    await prisma.concepto.update({ where: { id: concepto.id }, data: { codigo: nuevo } });
    console.log(`✔ Concepto renombrado: "${viejo}" → "${nuevo}"`);
  }

  // 2. Reescribir las fórmulas de TODAS las reglas que mencionen los códigos viejos
  const reglas = await prisma.reglaConcepto.findMany();
  let formulasActualizadas = 0;
  for (const r of reglas) {
    let formulaNueva = r.formula;
    for (const [viejo, nuevo] of Object.entries(RENOMBRES)) {
      formulaNueva = formulaNueva.replaceAll(`'${viejo}'`, `'${nuevo}'`);
    }
    if (formulaNueva !== r.formula) {
      await prisma.reglaConcepto.update({ where: { id: r.id }, data: { formula: formulaNueva } });
      console.log(`✔ Fórmula actualizada: "${r.formula}" → "${formulaNueva}"`);
      formulasActualizadas++;
    }
  }

  console.log(`\n${formulasActualizadas} fórmula(s) actualizada(s).`);
  console.log("\n⚠️ Volvé a liquidar la 1ra. Quincena de Julio (o cualquier período de Madera ya liquidado)");
  console.log("para que quede consistente con los nombres nuevos.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
