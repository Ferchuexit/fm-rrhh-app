// FM RRHH — prisma/crear-convenio-comercio.ts
// Arregla el error real encontrado: el convenio Comercio (0130/75) nunca se
// creó en la base — fix-convenio-real.ts (paso 1) solo corrigió Madera y
// creó Excluido, pero no Comercio. Por eso las categorías/escalas de
// Comercio se saltearon en silencio en import-catalogo-real.ts (paso 3), y
// los 18 empleados de Comercio se saltearon después en
// import-empleados-reales.ts (paso 4) — todo por esta única causa.
//
// Después de correr esto, hay que volver a correr, EN ESTE ORDEN:
//   npx tsx prisma/import-catalogo-real.ts     (ahora sí va a crear categorías/escalas de Comercio)
//   npx tsx prisma/import-empleados-reales.ts  (ahora sí va a importar los 18 empleados de Comercio)
// Los dos son no destructivos — no van a duplicar ni tocar lo de Madera/Excluido.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existente = await prisma.convenio.findUnique({ where: { codigo: "0130/75" } });
  if (existente) {
    console.log('El convenio "0130/75" ya existe — no había nada que crear.');
    return;
  }

  await prisma.convenio.create({
    data: { codigo: "0130/75", nombre: "Comercio (FAECYS — CCT 130/75)" },
  });
  console.log('✔ Convenio "0130/75" (Comercio) creado.');
  console.log("\nAhora corré, en este orden:");
  console.log("  npx tsx prisma/import-catalogo-real.ts");
  console.log("  npx tsx prisma/import-empleados-reales.ts");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
