import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const empresas = await prisma.empresa.findMany();
  console.log(`${empresas.length} empresa(s) en la base:`);
  for (const e of empresas) console.log(`  razonSocial: "${e.razonSocial}" | cuit guardado: "${e.cuit}" | domicilio: ${e.domicilio ?? "(vacío)"}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
