// FM RRHH — prisma/crear-reglas-comercio.ts
// Paso 5 del plan de datos reales: las reglas de Comercio (0130/75) no
// existían — solo se habían creado para Madera desde el principio del
// proyecto. Comercio tenía categorías y escalas (paso 3) pero NINGUNA
// fórmula, ni siquiera para el básico.
//
// Las 9 fórmulas de acá salieron de la hoja 4.3_Motor_Mensual de tu Excel,
// que vos mismo dejaste anotada como "validada contra recibo real de
// Junio/2024" (legajo Mosquera) — y se re-probaron acá contra tu propio
// legajo (452, Fernando Martínez) en el sandbox antes de escribir este
// script: los 8 conceptos, el bruto y el neto dieron EXACTOS a la fecha.
//
// ⚠️ Importante: estas tasas (8,33% presentismo, cuota sindical 2%, seguro
// sepelio 0,5%, seguro mercantil $4 fijo) son específicas de Comercio/FAECYS.
// NO se aplicaron a Madera — el propio PDF de USIMRA que compartiste dice
// "Presentismo: 10% de la liquidación del período", una tasa distinta, y
// no tengo un recibo real de Madera para validar sus descuentos de la misma
// forma. Madera queda con solo REM_BASICA armado (paso 2) — el resto es
// el próximo paso natural, no se improvisa acá.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VIGENCIA_DESDE = new Date("2026-01-01"); // misma fecha base que el resto del catálogo

const BASE_REM = "(CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD') + CONCEPTO('PRESENTISMO'))";

const REGLAS_COMERCIO = [
  { concepto: "REM_BASICA", formula: "BASICO", aporta: true, contribuye: true },
  { concepto: "ANTIGUEDAD", formula: "BASICO * ANTIGUEDAD_ANIOS * 0.01", aporta: true, contribuye: true },
  { concepto: "PRESENTISMO", formula: "(CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD')) * 0.0833", aporta: true, contribuye: true },
  { concepto: "JUBILACION", formula: `${BASE_REM} * 0.11`, aporta: false, contribuye: false },
  { concepto: "LEY_19032", formula: `${BASE_REM} * 0.03`, aporta: false, contribuye: false },
  { concepto: "OBRA_SOCIAL", formula: `${BASE_REM} * 0.03`, aporta: false, contribuye: false },
  { concepto: "SINDICATO", formula: `${BASE_REM} * 0.02`, aporta: false, contribuye: false },
  { concepto: "SEGURO_SEPELIO", formula: `${BASE_REM} * 0.005`, aporta: false, contribuye: false },
  { concepto: "SEGURO_MERCANTIL", formula: "4", aporta: false, contribuye: false },
];

async function main() {
  const convenio = await prisma.convenio.findUnique({ where: { codigo: "0130/75" } });
  if (!convenio) { console.log('No se encontró el convenio "0130/75" — ¿corriste crear-convenio-comercio.ts?'); return; }

  let creadas = 0, actualizadas = 0, sinConcepto = 0;

  for (const r of REGLAS_COMERCIO) {
    const concepto = await prisma.concepto.findUnique({ where: { codigo: r.concepto } });
    if (!concepto) {
      console.log(`⚠ Concepto "${r.concepto}" no existe — se salta.`);
      sinConcepto++;
      continue;
    }

    const existente = await prisma.reglaConcepto.findFirst({
      where: { conceptoId: concepto.id, convenioId: convenio.id, vigenciaHasta: null },
    });

    if (existente) {
      if (existente.formula === r.formula) continue; // ya está igual, no hacer nada
      await prisma.reglaConcepto.update({ where: { id: existente.id }, data: { formula: r.formula, aporta: r.aporta, contribuye: r.contribuye } });
      actualizadas++;
      console.log(`✔ Regla de "${r.concepto}" para Comercio actualizada.`);
    } else {
      await prisma.reglaConcepto.create({
        data: { conceptoId: concepto.id, convenioId: convenio.id, vigenciaDesde: VIGENCIA_DESDE, formula: r.formula, aporta: r.aporta, contribuye: r.contribuye },
      });
      creadas++;
      console.log(`✔ Regla de "${r.concepto}" para Comercio creada.`);
    }
  }

  console.log(`\n${creadas} reglas creadas, ${actualizadas} actualizadas, ${sinConcepto} saltadas por falta de concepto.`);
  console.log("\nProbá liquidar el período de julio de nuevo — tu propio legajo (452) y el resto de Comercio ya deberían calcular básico, antigüedad, presentismo y los 6 descuentos.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
