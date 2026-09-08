// FM RRHH — prisma/agregar-horas-extra-mensuales.ts
//
// Horas extra para convenios de BÁSICO MENSUAL (Comercio, y cualquier otro
// que se agregue después con el mismo esquema) — fórmula estándar LCT:
//
//   valor hora = básico mensual / horas del mes
//   hora al 50%  = valor hora × 1,5
//   hora al 100% = valor hora × 2
//
// "Horas del mes" = DIAS_MES × 8 — la misma jornada teórica que ya usa el
// resto del motor cuando no hay novedad de horas reales cargada (ver
// HORAS_TRABAJADAS en app/api/liquidar/route.ts). No se inventa un
// divisor nuevo, se reutiliza el mismo criterio que ya está en producción.
//
// Para JORNALEROS (Madera) esto NO aplica — ya tienen su propia fórmula
// basada en VALOR_HORA directo, confirmado funcionando por Fernando. Para
// CAMIONEROS tampoco aplica — ahí las horas extra son un valor fijo en
// pesos por categoría, ya cargado en cargar-convenio-camioneros.ts.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HOY = new Date();

const FORMULA_HS_50 = "(BASICO / (DIAS_MES * 8)) * 1.5 * CANTIDAD()";
const FORMULA_HS_100 = "(BASICO / (DIAS_MES * 8)) * 2 * CANTIDAD()";

// Convenios de básico mensual a los que aplicar esto — hoy solo Comercio.
// Si se agrega otro convenio mensual más adelante, solo hay que sumar su
// código acá, no hace falta tocar el resto del script.
const CONVENIOS_MENSUALES = ["0130/75"]; // Comercio

async function main() {
  const conceptoHs50 = await prisma.concepto.findUnique({ where: { codigo: "HS_EXTRA_50" } });
  const conceptoHs100 = await prisma.concepto.findUnique({ where: { codigo: "HS_EXTRA_100" } });
  if (!conceptoHs50 || !conceptoHs100) {
    console.log("⚠ No se encontraron HS_EXTRA_50/HS_EXTRA_100 en el catálogo.");
    return;
  }

  for (const codigoConvenio of CONVENIOS_MENSUALES) {
    const convenio = await prisma.convenio.findUnique({ where: { codigo: codigoConvenio } });
    if (!convenio) { console.log(`⚠ No existe el convenio "${codigoConvenio}" — se salta.`); continue; }

    for (const [concepto, formula] of [[conceptoHs50, FORMULA_HS_50], [conceptoHs100, FORMULA_HS_100]] as const) {
      const yaExiste = await prisma.reglaConcepto.findFirst({
        where: { conceptoId: concepto.id, convenioId: convenio.id, vigenciaHasta: null },
      });
      if (yaExiste) {
        if (yaExiste.formula === formula) {
          console.log(`  "${concepto.codigo}" (${codigoConvenio}) ya tenía exactamente esta fórmula — sin cambios.`);
        } else {
          console.log(`  ⚠ "${concepto.codigo}" (${codigoConvenio}) ya tiene OTRA fórmula vigente ("${yaExiste.formula}") — no se tocó. Si querés reemplazarla, hacelo desde /reglas para que quede versionada correctamente.`);
        }
        continue;
      }
      await prisma.reglaConcepto.create({
        data: { conceptoId: concepto.id, convenioId: convenio.id, vigenciaDesde: HOY, formula, aporta: true, contribuye: true },
      });
      console.log(`  ✔ "${concepto.codigo}" (${codigoConvenio}): ${formula}`);
    }
  }

  console.log("\nListo. Probá cargar una novedad de HS_EXTRA_50 o HS_EXTRA_100 para un legajo de Comercio y liquidar — el importe debería salir de básico/(días×8) con el recargo correspondiente.");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
