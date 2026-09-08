// FM RRHH — prisma/agregar-no-remunerativos-comercio.ts
// Todo lo que surgió del recibo real de Administrativo B (Intercec, Jul.2026):
//
// 1. Presentismo principal corregido: 0,0833 (truncado) → 1/12 exacto. Con
//    el cambio, TODO el recibo de referencia cierra exacto (bruto y 5
//    descuentos en cascada) — ver 53-recibo-completo-comercio.md para la
//    comparación completa. Esto difiere de lo que se validó contra el
//    recibo de Fernando (Jun/2024) — documentado, no escondido.
// 2. 7 conceptos no remunerativos nuevos, con las fórmulas reales
//    encontradas en el recibo (los "Presentismo X" NO son 8,333% de X
//    solo — son (X + su propia antigüedad) / 12, mismo patrón que el
//    Presentismo principal).
// 3. Sindicato y Faecys de Comercio: la base pasa a incluir los no
//    remunerativos (antes solo remunerativo) — confirmado por la cuenta
//    inversa contra el recibo real.
import { PrismaClient } from "@prisma/client";
import { sugerirProximoNumero } from "../lib/motor/catalogo-conceptos.mjs";

const prisma = new PrismaClient();
const VIGENCIA_DESDE = new Date("2026-01-01");

const CONCEPTOS_NUEVOS = [
  { codigo: "RECOMPOSICION_ABR26", nombre: "Recomposición Abr.2026", formula: "100000" },
  { codigo: "SUMA_FIJA_ABR26", nombre: "Suma Fija Abr.2026", formula: "20000" },
  { codigo: "SUMA_UNICA_REV26", nombre: "Suma No Rem. única - Rev.2026", formula: "25000" },
  { codigo: "ANTIG_RECOMP_ABR26", nombre: "Antigüedad Recomposición Abr.2026", formula: "CONCEPTO('RECOMPOSICION_ABR26') * ANTIGUEDAD_ANIOS * 0.01" },
  { codigo: "ANTIG_SUMAFIJA_ABR26", nombre: "Antigüedad Suma Fija Abr.2026", formula: "CONCEPTO('SUMA_FIJA_ABR26') * ANTIGUEDAD_ANIOS * 0.01" },
  { codigo: "PRESENTISMO_RECOMP_ABR26", nombre: "Presentismo Recomposición Abr.2026", formula: "(CONCEPTO('RECOMPOSICION_ABR26') + CONCEPTO('ANTIG_RECOMP_ABR26')) / 12" },
  { codigo: "PRESENTISMO_SUMAFIJA_ABR26", nombre: "Presentismo Suma Fija Abr.2026", formula: "(CONCEPTO('SUMA_FIJA_ABR26') + CONCEPTO('ANTIG_SUMAFIJA_ABR26')) / 12" },
];

async function crearConceptoSiNoExiste(codigo: string, nombre: string) {
  const existente = await prisma.concepto.findUnique({ where: { codigo } });
  if (existente) return existente;

  const rangos = await prisma.rangoNumeracion.findMany();
  const conceptosExistentes = await prisma.concepto.findMany();
  const numero = sugerirProximoNumero("no_remunerativo", rangos, conceptosExistentes as any);

  const creado = await prisma.concepto.create({
    data: { codigo, nombre, tipo: "no_remunerativo", unidad: "monto", numero, categoriaNovedad: "Básicos y Fijos" },
  });
  console.log(`✔ Concepto "${codigo}" creado (número ${numero}).`);
  return creado;
}

async function upsertRegla(convenioId: string, codigoConcepto: string, formula: string, aporta = false, contribuye = false) {
  const concepto = await prisma.concepto.findUnique({ where: { codigo: codigoConcepto } });
  if (!concepto) { console.log(`⚠ Concepto "${codigoConcepto}" no existe todavía — se salta.`); return; }

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
  const comercio = await prisma.convenio.findUnique({ where: { codigo: "0130/75" } });
  if (!comercio) { console.log('No se encontró el convenio "0130/75".'); return; }

  console.log("=== 1. Corrigiendo Presentismo principal (0,0833 → 1/12 exacto) ===");
  await upsertRegla(comercio.id, "PRESENTISMO", "(CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD')) / 12", true, true);

  console.log("\n=== 2. Creando los 7 conceptos no remunerativos nuevos ===");
  for (const c of CONCEPTOS_NUEVOS) {
    await crearConceptoSiNoExiste(c.codigo, c.nombre);
  }

  console.log("\n=== 3. Cargando sus fórmulas para Comercio ===");
  for (const c of CONCEPTOS_NUEVOS) {
    await upsertRegla(comercio.id, c.codigo, c.formula);
  }

  console.log("\n=== 4. Ampliando la base de Sindicato y Faecys (ahora incluyen no remunerativos) ===");
  await upsertRegla(comercio.id, "SINDICATO", "(REM_TOTAL() + NOREM_TOTAL()) * 0.02");
  await upsertRegla(comercio.id, "SEGURO_SEPELIO", "(REM_TOTAL() + NOREM_TOTAL()) * 0.005");

  console.log("\n⚠️ Esto cambia el neto de TODOS los legajos de Comercio ya liquidados.");
  console.log("Volvé a liquidar desde /liquidar (filtrando por convenio Comercio) para que quede actualizado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
