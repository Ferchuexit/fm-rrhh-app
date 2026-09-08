// FM RRHH — prisma/diagnostico-comercio.ts
// Diagnóstico puntual: por qué los empleados de Comercio (0130/75) no
// aparecen en /legajos aunque sí están bien en
// prisma/datos-reales-empleados.json. No modifica nada, solo informa.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== 1. ¿Existe el convenio 0130/75? ===");
  const convenio = await prisma.convenio.findUnique({ where: { codigo: "0130/75" } });
  console.log(convenio ? `Sí — id ${convenio.id}, nombre "${convenio.nombre}"` : "NO EXISTE — este es el problema.");
  if (!convenio) return;

  console.log("\n=== 2. ¿Existe la categoría 'ADMINISTRATIVO B' para ese convenio? ===");
  const categorias = await prisma.categoria.findMany({ where: { convenioId: convenio.id } });
  console.log(`Categorías totales para Comercio en la base: ${categorias.length}`);
  const adminB = categorias.find((c) => c.nombre === "ADMINISTRATIVO B");
  console.log(adminB ? `Sí — id ${adminB.id}` : "NO EXISTE — este es el problema.");
  if (categorias.length > 0 && categorias.length < 20) {
    console.log("Categorías de Comercio encontradas:", categorias.map((c) => c.nombre));
  }

  console.log("\n=== 3. ¿Existe el legajo 452 (Fernando Martínez)? ===");
  const legajo452 = await prisma.legajo.findFirst({ where: { numeroLegajo: 452 } });
  console.log(legajo452 ? `Sí — ${legajo452.apellido}, ${legajo452.nombre}` : "NO EXISTE en la base.");

  console.log("\n=== 4. ¿Cuántos legajos hay en total, y de qué convenio? ===");
  const todos = await prisma.legajo.findMany({ include: { convenio: true } });
  const porConvenio: Record<string, number> = {};
  for (const l of todos) porConvenio[l.convenio.codigo] = (porConvenio[l.convenio.codigo] || 0) + 1;
  console.log(`Total legajos en la base: ${todos.length}`);
  console.log("Por convenio:", porConvenio);

  console.log("\n=== 5. ¿A qué empresa pertenecen esos legajos, y cuál es la empresa actual? ===");
  const empresas = await prisma.empresa.findMany();
  console.log("Empresas en la base:", empresas.map((e) => ({ id: e.id, razonSocial: e.razonSocial })));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
