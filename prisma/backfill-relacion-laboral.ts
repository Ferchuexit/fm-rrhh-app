// FM RRHH — prisma/backfill-relacion-laboral.ts
//
// Se corre UNA sola vez, DESPUÉS de aplicar la migración que crea
// RelacionLaboral (npx prisma migrate dev --name relacion_laboral).
//
// Qué hace: por cada legajo existente, crea UNA fila en RelacionLaboral con
// el convenio/categoría que el legajo tiene HOY, con vigenciaDesde =
// fechaIngreso y vigenciaHasta = null (vigente). No inventa historial que
// no tenemos — simplemente arranca la tabla desde el estado actual. De acá
// en más, cada cambio de convenio/categoría se registra como una fila nueva
// (ver prisma/cambiar-relacion-laboral.ts).
//
// Es seguro correrlo más de una vez: si un legajo ya tiene una
// RelacionLaboral vigente, se salta (no duplica).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const legajos = await prisma.legajo.findMany({
    select: {
      id: true,
      apellido: true,
      nombre: true,
      numeroLegajo: true,
      fechaIngreso: true,
      convenioId: true,
      categoriaId: true,
    },
  });

  console.log(`Legajos encontrados: ${legajos.length}`);

  let creadas = 0;
  let saltadas = 0;

  for (const legajo of legajos) {
    const yaTiene = await prisma.relacionLaboral.findFirst({
      where: { legajoId: legajo.id, vigenciaHasta: null },
    });

    if (yaTiene) {
      saltadas++;
      continue;
    }

    await prisma.relacionLaboral.create({
      data: {
        legajoId: legajo.id,
        convenioId: legajo.convenioId,
        categoriaId: legajo.categoriaId,
        vigenciaDesde: legajo.fechaIngreso,
        vigenciaHasta: null,
        motivo: "ingreso (backfill inicial desde datos actuales del legajo)",
      },
    });
    creadas++;
    console.log(`  Legajo ${legajo.numeroLegajo} — ${legajo.apellido}, ${legajo.nombre}: relación laboral creada.`);
  }

  console.log(`\nListo. Creadas: ${creadas}. Ya tenían (saltadas): ${saltadas}.`);
}

main()
  .catch((e) => {
    console.error("Error en el backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
