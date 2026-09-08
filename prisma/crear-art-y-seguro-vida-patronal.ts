// FM RRHH — prisma/crear-art-y-seguro-vida-patronal.ts
// Las 2 contribuciones patronales que faltaban, ahora con las tasas reales
// de Moras (confirmadas por Fernando, no de fuente pública):
//
//   - ART: 3,1211% — compartida entre Madera y Comercio (misma
//     aseguradora). Base: bruto completo (remunerativo + no remunerativo).
//   - Seguro Colectivo de Vida y Sepelio (contribución patronal): 1% + 0,6%
//     = 1,6% — SOLO Madera (Art. 32 y 32 Bis CCT 335/75, Cta 900004/43
//     B.N.A. Suc. Caballito). Base: solo remunerativo, mismo criterio que
//     ya usa el aporte del empleado del mismo seguro (ver
//     52-sindicato-y-no-remunerativos.md).
//
// Con esto se completan las 4 contribuciones patronales del recibo — la
// torta ya debería mostrar los 5 rubros (neto + las 4).
import { PrismaClient } from "@prisma/client";
import { sugerirProximoNumero } from "../lib/motor/catalogo-conceptos.mjs";

const prisma = new PrismaClient();
const VIGENCIA_DESDE = new Date("2026-01-01");

async function crearConceptoSiNoExiste(codigo: string, nombre: string, rubro: string) {
  let concepto = await prisma.concepto.findUnique({ where: { codigo } });
  if (concepto) return concepto;
  const rangos = await prisma.rangoNumeracion.findMany();
  const existentes = await prisma.concepto.findMany();
  const numero = sugerirProximoNumero("contribucion_patronal", rangos, existentes as any) ??
    sugerirProximoNumero("descuento", rangos, existentes as any);
  concepto = await prisma.concepto.create({
    data: { codigo, nombre, tipo: "contribucion_patronal", unidad: "monto", rubro, numero },
  });
  console.log(`✔ Concepto "${codigo}" creado.`);
  return concepto;
}

async function cargarRegla(convenioCodigo: string, conceptoId: string, formula: string) {
  const convenio = await prisma.convenio.findUnique({ where: { codigo: convenioCodigo } });
  if (!convenio) { console.log(`⚠ No existe el convenio "${convenioCodigo}".`); return; }
  const existente = await prisma.reglaConcepto.findFirst({ where: { conceptoId, convenioId: convenio.id, vigenciaHasta: null } });
  if (existente) { console.log(`Ya estaba cargado para ${convenioCodigo} — sin cambios.`); return; }
  await prisma.reglaConcepto.create({ data: { conceptoId, convenioId: convenio.id, vigenciaDesde: VIGENCIA_DESDE, formula, aporta: false, contribuye: false } });
  console.log(`✔ Cargado para ${convenioCodigo}: "${formula}"`);
}

async function main() {
  console.log("=== ART (3,1211%, Madera + Comercio) ===");
  const art = await crearConceptoSiNoExiste("CONTRIB_ART", "ART", "art");
  await cargarRegla("0335/75", art.id, "(REM_TOTAL() + NOREM_TOTAL()) * 0.031211");
  await cargarRegla("0130/75", art.id, "(REM_TOTAL() + NOREM_TOTAL()) * 0.031211");

  console.log("\n=== Seguro Colectivo de Vida y Sepelio, contribución patronal (1,6%, solo Madera) ===");
  const seguro = await crearConceptoSiNoExiste("CONTRIB_SEGURO_VIDA", "Seguro Colectivo de Vida (contribución patronal)", "otros");
  await cargarRegla("0335/75", seguro.id, "REM_TOTAL() * 0.016");

  console.log("\nListo. Volvé a liquidar y descargá un recibo para ver la torta completa.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
