// FM RRHH — prisma/fix-convenio-real.ts
// Corrige el código de convenio inventado (0074/89) por el real (0335/75,
// USIMRA — confirmado contra tu Excel real, hoja 1.4_Convenios), y agrega
// el convenio "Excluido de Convenio" (9999/99, para directores/fuera de
// convenio). Se corre UNA vez — no resetea nada, solo actualiza/agrega.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const viejo = await prisma.convenio.findUnique({ where: { codigo: "0074/89" } });

  if (viejo) {
    await prisma.convenio.update({
      where: { id: viejo.id },
      data: { codigo: "0335/75", nombre: "Madera y Afines (USIMRA — CCT 335/75)" },
    });
    console.log('Convenio actualizado: "0074/89" (inventado) → "0335/75" (real, USIMRA).');
  } else {
    const yaExiste = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
    if (yaExiste) {
      console.log('El convenio "0335/75" ya existe — no había nada que corregir.');
    } else {
      console.log('No se encontró "0074/89" para corregir, y "0335/75" tampoco existe. Revisar a mano.');
    }
  }

  const excluido = await prisma.convenio.findUnique({ where: { codigo: "9999/99" } });
  if (!excluido) {
    await prisma.convenio.create({ data: { codigo: "9999/99", nombre: "Excluido de Convenio (Directores / fuera de convenio)" } });
    console.log('Convenio "9999/99" (Excluido de Convenio) creado.');
  } else {
    console.log('El convenio "9999/99" ya existía.');
  }

  console.log("\nListo. Revisá /legajos en la app — el convenio de tus legajos existentes debería mostrar ahora \"0335/75\".");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
