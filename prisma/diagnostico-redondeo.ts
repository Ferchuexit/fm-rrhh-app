// FM RRHH — prisma/diagnostico-redondeo.ts
// Ver si Redondeo realmente tiene una regla vigente para Madera, y si esa
// regla es la que /api/liquidar terminaría usando de verdad — mismo
// criterio de vigencia exacto que usa la ruta real. No modifica nada.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const redondeo = await prisma.concepto.findUnique({ where: { codigo: "REDONDEO" } });
  if (!redondeo) { console.log('❌ El concepto "REDONDEO" no existe en la base.'); return; }
  console.log(`✔ Concepto "REDONDEO" existe (id: ${redondeo.id}, tipo: ${redondeo.tipo}).`);

  const convenios = await prisma.convenio.findMany();
  for (const conv of convenios) {
    console.log(`\n=== Reglas de REDONDEO para ${conv.codigo} ===`);
    const todasLasReglas = await prisma.reglaConcepto.findMany({ where: { conceptoId: redondeo.id, convenioId: conv.id } });
    console.log(`  Total de filas (vigentes y vencidas): ${todasLasReglas.length}`);
    for (const r of todasLasReglas) {
      console.log(`    "${r.formula}" — vigenciaDesde: ${r.vigenciaDesde.toISOString().slice(0, 10)} — vigenciaHasta: ${r.vigenciaHasta ? r.vigenciaHasta.toISOString().slice(0, 10) : "(nunca)"}`);
    }
  }

  // Simular exactamente la consulta que hace /api/liquidar para un
  // período real de Madera
  const periodo = await prisma.periodo.findFirst({ where: { nombre: { contains: "Quincena Julio" } } });
  if (!periodo) { console.log("\nNo se encontró ningún período de quincena de julio para probar."); return; }

  const madera = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
  const reglasQueLlegan = await prisma.reglaConcepto.findMany({
    where: {
      convenioId: madera!.id,
      vigenciaDesde: { lte: periodo.fechaDesde },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: periodo.fechaDesde } }],
    },
    include: { concepto: true },
  });
  const tieneRedondeo = reglasQueLlegan.some((r) => r.concepto.codigo === "REDONDEO");
  console.log(`\n=== Simulando la consulta real de /api/liquidar para "${periodo.nombre}" ===`);
  console.log(`Total de reglas que le llegarían a un legajo de Madera: ${reglasQueLlegan.length}`);
  console.log(`¿Incluye REDONDEO?`, tieneRedondeo ? "✔ SÍ" : "❌ NO — esta es la causa del problema");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
