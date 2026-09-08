// FM RRHH — prisma/fijar-convenio-quincenas-madera.ts
// Le asigna el convenio Madera (0335/75) a las quincenas ya creadas —
// pensadas solo para Madera, pero sin nada que lo impidiera hasta ahora.
// De paso, limpia cualquier liquidación de OTRO convenio que se haya
// colado por error (como Comercio en la 1ra. Quincena de Julio).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const madera = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
  if (!madera) { console.log('No se encontró el convenio "0335/75".'); return; }

  const quincenas = await prisma.periodo.findMany({ where: { nombre: { contains: "Quincena" } } });
  console.log(`${quincenas.length} período(s) con "Quincena" en el nombre.`);

  for (const p of quincenas) {
    if (p.convenioId === madera.id) { console.log(`"${p.nombre}": ya estaba fijado a Madera.`); continue; }

    await prisma.periodo.update({ where: { id: p.id }, data: { convenioId: madera.id } });
    console.log(`✔ "${p.nombre}" → convenio fijado a Madera.`);

    // Limpiar liquidaciones de OTRO convenio que se hayan colado
    const liquidacionesColadas = await prisma.liquidacion.findMany({
      where: { periodoId: p.id, legajo: { convenioId: { not: madera.id } } },
      include: { legajo: true },
    });
    if (liquidacionesColadas.length > 0) {
      console.log(`  ⚠ ${liquidacionesColadas.length} legajo(s) de otro convenio se habían colado en "${p.nombre}":`);
      for (const l of liquidacionesColadas) console.log(`    - Legajo ${l.legajo.numeroLegajo} (${l.legajo.apellido})`);
      const ids = liquidacionesColadas.map((l) => l.id);
      await prisma.liquidacionDetalle.deleteMany({ where: { liquidacionId: { in: ids } } });
      await prisma.liquidacion.deleteMany({ where: { id: { in: ids } } });
      console.log(`  ✔ Liquidaciones coladas eliminadas.`);
    }
  }

  console.log("\nListo. De acá en más, 'Todos' en /liquidar/recibos para estas quincenas solo va a tomar Madera.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
