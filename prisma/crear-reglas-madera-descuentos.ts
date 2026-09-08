// FM RRHH — prisma/crear-reglas-madera-descuentos.ts
// Las 4 fórmulas de descuento de Madera que confirmaste, probadas antes en
// el sandbox (ver 45-rem-total-y-descuentos-madera.md):
//   - Jubilación:    11% sobre el total remunerativo
//   - Ley 19.032:    3%  sobre el total remunerativo — ⚠️ ASUNCIÓN: misma
//                     base que Jubilación (no me diste la base explícita
//                     para esta, solo la tasa). Si en realidad lleva los
//                     no remunerativos también, cambiá la fórmula de abajo
//                     de REM_TOTAL() a (REM_TOTAL() + NOREM_TOTAL()).
//   - Obra Social:   3%   sobre remunerativo + no remunerativo
//   - Sindicato:     1,5% sobre remunerativo + no remunerativo
//
// Usa REM_TOTAL() y NOREM_TOTAL(), las dos funciones nuevas del motor — no
// hace falta sumar cada concepto remunerativo a mano en la fórmula, y no se
// rompe si mañana se agrega un concepto remunerativo nuevo a Madera.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VIGENCIA_DESDE = new Date("2026-01-01"); // misma fecha base que el resto del catálogo

const REGLAS_MADERA = [
  { concepto: "JUBILACION", formula: "REM_TOTAL() * 0.11" },
  { concepto: "LEY_19032", formula: "REM_TOTAL() * 0.03" }, // ⚠️ ver nota de arriba
  { concepto: "OBRA_SOCIAL", formula: "(REM_TOTAL() + NOREM_TOTAL()) * 0.03" },
  { concepto: "SINDICATO", formula: "(REM_TOTAL() + NOREM_TOTAL()) * 0.015" },
];

async function main() {
  const convenio = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
  if (!convenio) { console.log('No se encontró el convenio "0335/75".'); return; }

  let creadas = 0, actualizadas = 0, sinConcepto = 0;

  for (const r of REGLAS_MADERA) {
    const concepto = await prisma.concepto.findUnique({ where: { codigo: r.concepto } });
    if (!concepto) {
      console.log(`⚠ Concepto "${r.concepto}" no existe — se salta. (¿Se cargó el catálogo real? Ver 33-catalogo-real.md.)`);
      sinConcepto++;
      continue;
    }

    const existente = await prisma.reglaConcepto.findFirst({
      where: { conceptoId: concepto.id, convenioId: convenio.id, vigenciaHasta: null },
    });

    if (existente) {
      if (existente.formula === r.formula) { console.log(`"${r.concepto}" ya tenía esta misma fórmula — sin cambios.`); continue; }
      await prisma.reglaConcepto.update({ where: { id: existente.id }, data: { formula: r.formula, aporta: false, contribuye: false } });
      actualizadas++;
      console.log(`✔ Regla de "${r.concepto}" para Madera actualizada: "${existente.formula}" → "${r.formula}"`);
    } else {
      await prisma.reglaConcepto.create({
        data: { conceptoId: concepto.id, convenioId: convenio.id, vigenciaDesde: VIGENCIA_DESDE, formula: r.formula, aporta: false, contribuye: false },
      });
      creadas++;
      console.log(`✔ Regla de "${r.concepto}" para Madera creada: "${r.formula}"`);
    }
  }

  console.log(`\n${creadas} reglas creadas, ${actualizadas} actualizadas, ${sinConcepto} saltadas por falta de concepto.`);
  console.log("\n⚠️ Recordatorio: esto CAMBIA el neto calculado de todos los legajos de Madera que ya");
  console.log("liquidaste (antes no tenían estos 4 descuentos armados) — es esperado, no un error.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
