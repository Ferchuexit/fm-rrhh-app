// FM RRHH — prisma/diagnostico-contribuciones.ts
// Ver exactamente qué contribuciones patronales existen hoy en la base,
// por convenio — para saber si falta correr algún script, o si hay un
// problema real. No modifica nada.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const conceptos = await prisma.concepto.findMany({ where: { tipo: "contribucion_patronal" } });
  console.log(`=== Conceptos tipo 'contribucion_patronal' en la base: ${conceptos.length} ===`);
  for (const c of conceptos) console.log(`  ${c.codigo} — "${c.nombre}" (rubro: ${c.rubro ?? "sin rubro"}, número: ${c.numero ?? "sin número"})`);

  const convenios = await prisma.convenio.findMany();
  for (const conv of convenios) {
    console.log(`\n=== Reglas de contribución patronal para ${conv.codigo} ===`);
    const reglas = await prisma.reglaConcepto.findMany({
      where: { convenioId: conv.id, concepto: { tipo: "contribucion_patronal" }, vigenciaHasta: null },
      include: { concepto: true },
    });
    if (reglas.length === 0) console.log("  Ninguna.");
    for (const r of reglas) console.log(`  ${r.concepto.codigo}: "${r.formula}"`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
