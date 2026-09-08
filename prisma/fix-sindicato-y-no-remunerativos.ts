// FM RRHH — prisma/fix-sindicato-y-no-remunerativos.ts
// Tres correcciones/altas, todas con fuente real (el PDF oficial de USIMRA
// que ya compartiste, y la circular de FAECYS):
//
// 1. SINDICATO de Madera estaba mal — en la vuelta 45 quedó al 1,5%
//    (mezclado con lo que en realidad es Seguro Sepelio). El PDF de USIMRA
//    dice literal "CUOTA SINDICAL: 3%". Se corrige.
// 2. SEGURO_SEPELIO (Faecys/Seguro de Vida y Sepelio) para Madera no
//    existía — el PDF dice "Aporte Obrero 1,5%". Se agrega, sobre
//    REM_TOTAL() solamente (no incluye no remunerativos, a diferencia de
//    Sindicato/Obra Social) — así lo confirmaste vos.
// 3. El S.N.R. (Suma No Remunerativa) de Madera — tu PDF de USIMRA muestra
//    una columna "S.N.R. 1,90%" en cada categoría, calculada sobre el
//    básico. Se agrega como no remunerativo, usando el concepto
//    INCREMENTO_NR que ya existía en el catálogo (sin fórmula para Madera
//    todavía).
//
// Comercio NO se toca en este script — su Sindicato (2%) y Seguro Sepelio
// (0,5%) ya estaban bien desde la vuelta 38, y su "no remunerativo" está en
// $0 para julio 2026 según tu propia circular de FAECYS (se absorbió en el
// básico desde abril) — ver 52-sindicato-y-no-remunerativos.md.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VIGENCIA_DESDE = new Date("2026-01-01");

async function upsertRegla(convenioId: string, codigoConcepto: string, formula: string, aporta: boolean, contribuye: boolean) {
  const concepto = await prisma.concepto.findUnique({ where: { codigo: codigoConcepto } });
  if (!concepto) { console.log(`⚠ Concepto "${codigoConcepto}" no existe — se salta.`); return; }

  const existente = await prisma.reglaConcepto.findFirst({ where: { conceptoId: concepto.id, convenioId, vigenciaHasta: null } });
  if (existente) {
    if (existente.formula === formula) { console.log(`"${codigoConcepto}": ya tenía esta fórmula — sin cambios.`); return; }
    await prisma.reglaConcepto.update({ where: { id: existente.id }, data: { formula, aporta, contribuye } });
    console.log(`✔ "${codigoConcepto}" actualizado: "${existente.formula}" → "${formula}"`);
  } else {
    await prisma.reglaConcepto.create({ data: { conceptoId: concepto.id, convenioId, vigenciaDesde: VIGENCIA_DESDE, formula, aporta, contribuye } });
    console.log(`✔ "${codigoConcepto}" creado: "${formula}"`);
  }
}

async function main() {
  const madera = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
  if (!madera) { console.log('No se encontró el convenio "0335/75".'); return; }

  console.log("=== 1. Corrigiendo Sindicato de Madera (1,5% → 3%) ===");
  await upsertRegla(madera.id, "SINDICATO", "(REM_TOTAL() + NOREM_TOTAL()) * 0.03", false, false);

  console.log("\n=== 2. Agregando Seguro Sepelio de Madera (1,5% sobre solo remunerativo) ===");
  await upsertRegla(madera.id, "SEGURO_SEPELIO", "REM_TOTAL() * 0.015", false, false);

  console.log("\n=== 3. Agregando S.N.R. (no remunerativo) de Madera (1,90% del básico) ===");
  await upsertRegla(madera.id, "INCREMENTO_NR", "CONCEPTO('REM_BASICA') * 0.019", false, false);

  console.log("\n⚠️ Esto cambia el neto de todos los legajos de Madera que ya liquidaste.");
  console.log("Volvé a liquidar desde /liquidar (filtrando por convenio Madera) para que quede actualizado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
