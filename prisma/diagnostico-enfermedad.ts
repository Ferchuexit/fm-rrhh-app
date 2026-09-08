import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const codigos = ["ENFERMEDADES", "HS_ENFERMEDAD", "ENFERMEDAD", "HS_ACCIDENTE", "HS_ART", "SEGURO_MERCANTIL"];
  for (const codigo of codigos) {
    const c = await prisma.concepto.findUnique({ where: { codigo } });
    if (!c) { console.log(`"${codigo}": no existe.`); continue; }
    const reglas = await prisma.reglaConcepto.findMany({ where: { conceptoId: c.id }, include: { convenio: true } });
    console.log(`"${codigo}" (id: ${c.id.slice(0,8)}..., tipo: ${c.tipo}, codigoArca: ${(c as any).codigoArca ?? "(sin asignar)"}):`);
    if (reglas.length === 0) console.log("  Sin ninguna regla cargada en ningún convenio.");
    for (const r of reglas) console.log(`  ${r.convenio.codigo}: "${r.formula}"`);
  }

  console.log("\n=== Fórmulas que mencionan 'ENFERMEDADES' o 'ENFERMEDAD' (por si quedó una referencia colgada) ===");
  const todas = await prisma.reglaConcepto.findMany({ include: { concepto: true, convenio: true } });
  for (const r of todas) {
    if (r.formula.includes("ENFERMEDAD")) {
      console.log(`  ${r.concepto.codigo} (${r.convenio.codigo}): "${r.formula}"`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
