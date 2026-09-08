// FM RRHH — prisma/diagnostico-escalas-faltantes.ts
// Revisa, para cada legajo con error, si hay categorías DUPLICADAS con el
// mismo nombre (el legajo apuntando a una, la escala creada en otra) — no
// modifica nada, solo informa.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGAJOS_CON_ERROR = [13, 25, 57, 70, 72, 82, 83, 88, 92, 460, 461, 465];

async function main() {
  for (const numero of LEGAJOS_CON_ERROR) {
    const legajo = await prisma.legajo.findFirst({ where: { numeroLegajo: numero }, include: { categoria: true, convenio: true } });
    if (!legajo) { console.log(`Legajo ${numero}: no existe.`); continue; }

    console.log(`\n=== Legajo ${numero} — ${legajo.apellido}, ${legajo.nombre} ===`);
    console.log(`Categoría del legajo: "${legajo.categoria.nombre}" (id: ${legajo.categoriaId})`);

    // ¿Hay más de una categoría con este mismo nombre, en el mismo convenio?
    const duplicadas = await prisma.categoria.findMany({ where: { convenioId: legajo.convenioId, nombre: legajo.categoria.nombre } });
    console.log(`Categorías con el nombre "${legajo.categoria.nombre}" en este convenio: ${duplicadas.length}`, duplicadas.map((c) => c.id));

    // Escalas que existen para CADA una de esas categorías (por si el legajo apunta a la que no tiene escala)
    for (const cat of duplicadas) {
      const escalas = await prisma.escala.findMany({ where: { categoriaId: cat.id } });
      console.log(`  Escalas para categoriaId ${cat.id}: ${escalas.length}`, escalas.map((e) => `vigente ${e.vigenciaDesde.toISOString()}`));
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
