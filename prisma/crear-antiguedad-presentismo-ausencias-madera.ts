// FM RRHH — prisma/crear-antiguedad-presentismo-ausencias-madera.ts
// Tres piezas que Madera nunca tuvo, encontradas al comparar contra tu
// Excel real de la 1ra. Quincena de Julio — ver 66-ausencias-presentismo.md.
// Las tres probadas contra los números reales de Chousa antes de este
// script: Antigüedad, Presentismo (exacto hasta el centavo), Total
// Remunerativo y Jubilación también exactos.
//
//   - Antigüedad: 1% por año, sobre el básico YA CALCULADO (no la tasa por
//     hora) — CONCEPTO('REM_BASICA'), no BASICO.
//   - Presentismo: 10% sobre (básico+antigüedad) — pero SOLO si no hubo
//     ninguna ausencia en el período. Si hubo, se pierde entero (no se
//     prorratea) — "presentismo perfecto", como en tu Excel real.
//   - Ausencias: horas de ausencia × valor hora, restado del básico — se
//     carga como novedad del concepto HS_AUSENCIAS.
import { PrismaClient } from "@prisma/client";
import { sugerirProximoNumero } from "../lib/motor/catalogo-conceptos.mjs";

const prisma = new PrismaClient();
const VIGENCIA_DESDE = new Date("2026-01-01");

async function crearConceptoSiNoExiste(codigo: string, nombre: string, unidad: string) {
  let concepto = await prisma.concepto.findUnique({ where: { codigo } });
  if (concepto) return concepto;
  const rangos = await prisma.rangoNumeracion.findMany();
  const existentes = await prisma.concepto.findMany();
  const numero = sugerirProximoNumero("remunerativo", rangos, existentes as any);
  concepto = await prisma.concepto.create({ data: { codigo, nombre, tipo: "remunerativo", unidad, numero, categoriaNovedad: "Horas" } });
  console.log(`✔ Concepto "${codigo}" creado.`);
  return concepto;
}

async function upsertRegla(convenioId: string, conceptoId: string, codigo: string, formula: string) {
  const existente = await prisma.reglaConcepto.findFirst({ where: { conceptoId, convenioId, vigenciaHasta: null } });
  if (existente) {
    if (existente.formula === formula) { console.log(`"${codigo}": ya tenía esta fórmula — sin cambios.`); return; }
    await prisma.reglaConcepto.update({ where: { id: existente.id }, data: { formula, aporta: true, contribuye: true } });
    console.log(`✔ "${codigo}" actualizado: "${existente.formula}" → "${formula}"`);
  } else {
    await prisma.reglaConcepto.create({ data: { conceptoId, convenioId, vigenciaDesde: VIGENCIA_DESDE, formula, aporta: true, contribuye: true } });
    console.log(`✔ "${codigo}" creado para Madera: "${formula}"`);
  }
}

async function main() {
  const madera = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
  if (!madera) { console.log('No se encontró el convenio "0335/75".'); return; }

  const ausencias = await crearConceptoSiNoExiste("HS_AUSENCIAS", "Hs. Ausencias", "horas");
  const antiguedad = await prisma.concepto.findUnique({ where: { codigo: "ANTIGUEDAD" } });
  const presentismo = await prisma.concepto.findUnique({ where: { codigo: "PRESENTISMO" } });
  if (!antiguedad || !presentismo) { console.log("Faltan los conceptos ANTIGUEDAD o PRESENTISMO en el catálogo — ¿se corrió el catálogo real?"); return; }

  await upsertRegla(madera.id, ausencias.id, "HS_AUSENCIAS", "-1 * CANTIDAD() * VALOR_HORA");
  await upsertRegla(madera.id, antiguedad.id, "ANTIGUEDAD", "CONCEPTO('REM_BASICA') * ANTIGUEDAD_ANIOS * 0.01");
  await upsertRegla(madera.id, presentismo.id, "PRESENTISMO", "IF(CANTIDAD('HS_AUSENCIAS') == 0, (CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD')) * 0.10, 0)");

  console.log("\n⚠️ Esto cambia el neto de los legajos de Madera ya liquidados (ahora tienen Antigüedad y Presentismo,");
  console.log("que antes no existían para este convenio). Volvé a liquidar filtrando por convenio Madera.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
