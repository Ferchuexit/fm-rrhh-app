// FM RRHH — prisma/crear-enfermedades-feriados-art-vacaciones-madera.ts
// Segundo paso del plan de conversión de Madera — ver 67-enfermedades-snr.md.
// Probado contra DOS empleados reales distintos (Chousa con ausencia,
// Pereyra con enfermedad) antes de este script — el motor no necesitó
// ningún cambio nuevo, todo se pudo expresar con lo que ya teníamos.
//
//   - Enfermedades, Feriados trabajados, Horas de accidente, Vacaciones:
//     horas cargadas por novedad × valor hora, sumadas al básico.
//   - Antigüedad y Presentismo: se ACTUALIZAN (no se crean de nuevo) para
//     incluir estos conceptos en su base, igual que tu Excel real.
//     Presentismo se pierde si hay CUALQUIER ausencia O enfermedad (antes
//     solo miraba ausencias).
//   - S.N.R. y Ajuste SAC (dos conceptos, misma fórmula — así está en tu
//     Excel real, no es un error): 1,9% del valor-hora, mutiplicado por
//     las horas REALES del período (trabajadas + enfermedad + feriados +
//     accidente + vacaciones - ausencias) — no el básico completo. Esto
//     reemplaza el INCREMENTO_NR viejo (que usaba básico × 1,9% fijo, sin
//     enterarse de ausencias).
import { PrismaClient } from "@prisma/client";
import { sugerirProximoNumero } from "../lib/motor/catalogo-conceptos.mjs";

const prisma = new PrismaClient();
const VIGENCIA_DESDE = new Date("2026-01-01");

async function crearConceptoSiNoExiste(codigo: string, nombre: string, tipo: string) {
  let concepto = await prisma.concepto.findUnique({ where: { codigo } });
  if (concepto) return concepto;
  const rangos = await prisma.rangoNumeracion.findMany();
  const existentes = await prisma.concepto.findMany();
  const numero = sugerirProximoNumero(tipo, rangos, existentes as any);
  concepto = await prisma.concepto.create({ data: { codigo, nombre, tipo, unidad: "horas", numero, categoriaNovedad: "Horas" } });
  console.log(`✔ Concepto "${codigo}" creado.`);
  return concepto;
}

async function upsertRegla(convenioId: string, conceptoId: string, codigo: string, formula: string) {
  const existente = await prisma.reglaConcepto.findFirst({ where: { conceptoId, convenioId, vigenciaHasta: null } });
  if (existente) {
    if (existente.formula === formula) { console.log(`"${codigo}": sin cambios.`); return; }
    await prisma.reglaConcepto.update({ where: { id: existente.id }, data: { formula, aporta: true, contribuye: true } });
    console.log(`✔ "${codigo}" actualizado: "${existente.formula}" → "${formula}"`);
  } else {
    await prisma.reglaConcepto.create({ data: { conceptoId, convenioId, vigenciaDesde: VIGENCIA_DESDE, formula, aporta: true, contribuye: true } });
    console.log(`✔ "${codigo}" creado para Madera.`);
  }
}

const BASE_ANTIG = "(CONCEPTO('REM_BASICA') + CONCEPTO('ENFERMEDADES') + CONCEPTO('FERIADOS') + CONCEPTO('HS_ACCIDENTE'))";
const TOTAL_HORAS = "(HORAS_TRABAJADAS + CANTIDAD('ENFERMEDADES') + CANTIDAD('FERIADOS') + CANTIDAD('HS_ACCIDENTE') + CANTIDAD('VACACIONES_HORAS') - CANTIDAD('HS_AUSENCIAS'))";

async function main() {
  const madera = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
  if (!madera) { console.log('No se encontró el convenio "0335/75".'); return; }

  const enfermedades = await crearConceptoSiNoExiste("ENFERMEDADES", "Enfermedades", "remunerativo");
  const feriados = await crearConceptoSiNoExiste("FERIADOS", "Feriados trabajados", "remunerativo");
  const hsAccidente = await crearConceptoSiNoExiste("HS_ACCIDENTE", "Horas de Accidente (ART)", "remunerativo");
  const vacaciones = await crearConceptoSiNoExiste("VACACIONES_HORAS", "Vacaciones (horas)", "remunerativo");
  const snr = await crearConceptoSiNoExiste("SNR", "S.N.R.", "no_remunerativo");
  const ajusteSac = await crearConceptoSiNoExiste("AJUSTE_SAC", "Ajuste SAC", "no_remunerativo");

  const antiguedad = await prisma.concepto.findUnique({ where: { codigo: "ANTIGUEDAD" } });
  const presentismo = await prisma.concepto.findUnique({ where: { codigo: "PRESENTISMO" } });
  const incrementoNrViejo = await prisma.concepto.findUnique({ where: { codigo: "INCREMENTO_NR" } });
  if (!antiguedad || !presentismo) { console.log("Faltan ANTIGUEDAD o PRESENTISMO — ¿se corrió la vuelta 66?"); return; }

  await upsertRegla(madera.id, enfermedades.id, "ENFERMEDADES", "CANTIDAD() * VALOR_HORA");
  await upsertRegla(madera.id, feriados.id, "FERIADOS", "CANTIDAD() * VALOR_HORA");
  await upsertRegla(madera.id, hsAccidente.id, "HS_ACCIDENTE", "CANTIDAD() * VALOR_HORA");
  await upsertRegla(madera.id, vacaciones.id, "VACACIONES_HORAS", "CANTIDAD() * VALOR_HORA");
  await upsertRegla(madera.id, antiguedad.id, "ANTIGUEDAD", `${BASE_ANTIG} * ANTIGUEDAD_ANIOS * 0.01`);
  await upsertRegla(
    madera.id,
    presentismo.id,
    "PRESENTISMO",
    "IF(CANTIDAD('HS_AUSENCIAS') + CANTIDAD('ENFERMEDADES') == 0, (CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD') + CONCEPTO('FERIADOS') + CONCEPTO('HS_ACCIDENTE')) * 0.10, 0)"
  );
  await upsertRegla(madera.id, snr.id, "SNR", `${TOTAL_HORAS} * VALOR_HORA * 0.019`);
  await upsertRegla(madera.id, ajusteSac.id, "AJUSTE_SAC", `${TOTAL_HORAS} * VALOR_HORA * 0.019`);

  if (incrementoNrViejo) {
    const reglaVieja = await prisma.reglaConcepto.findFirst({ where: { conceptoId: incrementoNrViejo.id, convenioId: madera.id, vigenciaHasta: null } });
    if (reglaVieja) {
      await prisma.reglaConcepto.delete({ where: { id: reglaVieja.id } });
      console.log('✔ INCREMENTO_NR (el viejo, básico×1,9% fijo) desactivado para Madera — reemplazado por S.N.R. + Ajuste SAC.');
    }
  }

  console.log("\n⚠️ Esto cambia el neto de todos los legajos de Madera ya liquidados.");
  console.log("Volvé a liquidar filtrando por convenio Madera.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
