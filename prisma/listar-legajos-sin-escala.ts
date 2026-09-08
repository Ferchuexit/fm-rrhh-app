// FM RRHH — prisma/listar-legajos-sin-escala.ts
// Repite EXACTAMENTE la misma búsqueda de escala que usa /api/liquidar,
// para cada legajo activo, y lista cuáles fallan — sin liquidar nada, solo
// para saber con certeza cuáles son "los 8" de esta corrida en particular
// (la lista puede cambiar de una corrida a otra a medida que se van
// arreglando cosas, como ya pasó con el legajo 13).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const periodo = await prisma.periodo.findFirst({ where: { nombre: "Julio 2026" } });
  if (!periodo) { console.log('No se encontró el período "Julio 2026".'); return; }

  const legajos = await prisma.legajo.findMany({ where: { empresaId: periodo.empresaId, condicion: "activo" }, include: { categoria: true, convenio: true } });

  console.log(`Revisando ${legajos.length} legajos activos contra el período "${periodo.nombre}" (vigente ${periodo.fechaDesde.toISOString()})...\n`);

  const sinEscala: typeof legajos = [];

  for (const legajo of legajos) {
    const escala = await prisma.escala.findFirst({
      where: {
        categoriaId: legajo.categoriaId,
        vigenciaDesde: { lte: periodo.fechaDesde },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: periodo.fechaDesde } }],
      },
      orderBy: { vigenciaDesde: "desc" },
    });
    if (!escala) sinEscala.push(legajo);
  }

  console.log(`=== ${sinEscala.length} legajos SIN escala vigente ===`);
  for (const l of sinEscala) {
    console.log(`Legajo ${l.numeroLegajo} — ${l.apellido}, ${l.nombre} — convenio ${l.convenio.codigo} — categoría "${l.categoria.nombre}" (categoriaId: ${l.categoriaId})`);
  }

  // Cuántas escalas hay en total en la base, y cuántas categorías distintas cubren
  const totalEscalas = await prisma.escala.count();
  const categoriasConEscala = await prisma.escala.findMany({ select: { categoriaId: true }, distinct: ["categoriaId"] });
  console.log(`\nTotal de filas en la tabla Escala: ${totalEscalas} (cubriendo ${categoriasConEscala.length} categorías distintas — si esto es mucho más que ~48, hay filas duplicadas).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
