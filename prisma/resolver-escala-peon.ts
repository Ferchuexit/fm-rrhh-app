// FM RRHH — prisma/resolver-escala-peon.ts
// Peón = Operario Act. Industrial, confirmado por Fernando y por el PDF
// oficial de USIMRA (escala_salarial_muebles2026c.pdf, acuerdo vigente
// Junio 2026/Mayo 2027) — mismo valor exacto en la columna "VI-OPERARIO
// ACT. INDUSTRIAL". Copia la escala vigente de esa categoría a "PEON".
// No destructivo — se puede correr más de una vez sin duplicar.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const convenio = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
  if (!convenio) { console.log('No se encontró el convenio "0335/75".'); return; }

  const operario = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, nombre: "OPERARIO ACT. INDUSTRIAL" } });
  const peon = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, nombre: "PEON" } });
  if (!operario || !peon) { console.log("No se encontró la categoría Operario Act. Industrial o Peón — ¿corriste import-catalogo-real.ts?"); return; }

  // ⚠️ Corrección sobre la primera versión de este script: acá se pedía la
  // escala MÁS RECIENTE de Operario Act. Industrial sin más — eso copiaba la
  // de septiembre, que no sirve para liquidar julio. Ahora se pide
  // puntualmente la que estaba vigente al 1° de julio (mismo criterio que
  // ya se usa en /api/liquidar) — ver 42-fix-peon-julio.md.
  const FECHA_REFERENCIA = new Date("2026-07-01");
  const escalaOperario = await prisma.escala.findFirst({
    where: { categoriaId: operario.id, vigenciaDesde: { lte: FECHA_REFERENCIA } },
    orderBy: { vigenciaDesde: "desc" },
  });
  if (!escalaOperario) { console.log("Operario Act. Industrial no tiene ninguna escala vigente al 1° de julio — nada para copiar."); return; }

  const yaExiste = await prisma.escala.findFirst({ where: { categoriaId: peon.id, vigenciaDesde: escalaOperario.vigenciaDesde } });
  if (yaExiste) { console.log("Peón ya tiene esta escala cargada — no había nada que hacer."); return; }

  await prisma.escala.create({
    data: {
      convenioId: convenio.id,
      categoriaId: peon.id,
      vigenciaDesde: escalaOperario.vigenciaDesde,
      basico: escalaOperario.basico,
      valorHora: escalaOperario.valorHora,
    },
  });

  console.log(`✔ Escala de Peón cargada: $${escalaOperario.valorHora}/hora, vigente desde ${escalaOperario.vigenciaDesde.toISOString()}.`);
  console.log("(Mismo valor que Operario Act. Industrial vigente en julio — confirmado contra el PDF oficial de USIMRA.)");
  console.log("\nLos 5 empleados activos con categoría Peón ya pueden liquidarse.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
