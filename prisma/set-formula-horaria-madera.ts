// FM RRHH — prisma/set-formula-horaria-madera.ts
// Cambia la fórmula de REM_BASICA para el convenio Madera (0335/75) de
// básico fijo mensual a valor hora × horas trabajadas — así se calcula de
// verdad en tu Excel real (hoja 4.2_Motor_Quincenal). Se corrige DIRECTO,
// sin versionar por vigencia — la fórmula vieja nunca fue una política real,
// era el valor de prueba de antes de leer tu Excel (ver el porqué en el
// bloque de abajo). Se corre UNA vez.
//
// ⚠️ Esto CAMBIA el bruto calculado de cualquier legajo de Madera que ya
// tengas cargado — es esperado, no un error: son dos metodologías de
// cálculo distintas (básico fijo vs. horas × valor hora). Ver 32-calculo-por-hora.md.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const convenio = await prisma.convenio.findUnique({ where: { codigo: "0335/75" } });
  if (!convenio) {
    console.log('No se encontró el convenio "0335/75" — ¿corriste primero fix-convenio-real.ts?');
    return;
  }

  const remBasica = await prisma.concepto.findUnique({ where: { codigo: "REM_BASICA" } });
  if (!remBasica) {
    console.log('No se encontró el concepto "REM_BASICA".');
    return;
  }

  const vigenteActual = await prisma.reglaConcepto.findFirst({
    where: { conceptoId: remBasica.id, convenioId: convenio.id, vigenciaHasta: null },
  });

  const nuevaFormula = "VALOR_HORA * HORAS_TRABAJADAS";

  if (vigenteActual?.formula === nuevaFormula) {
    console.log("La fórmula ya está actualizada — no había nada que hacer.");
    return;
  }

  if (vigenteActual) {
    // Se corrige DIRECTO, sin versionar: la fórmula vieja (BASICO fijo)
    // nunca fue una política real vigente en algún momento — era el valor
    // de prueba que se cargó al principio de este proyecto, antes de leer
    // tu Excel real. Versionarla como si hubiera un "antes y después" legítimo
    // crearía un hueco de vigencia sin sentido (la regla vieja terminando un
    // día antes de su propio inicio). Es una corrección de dato, no un
    // cambio de política — se actualiza en el lugar.
    await prisma.reglaConcepto.update({ where: { id: vigenteActual.id }, data: { formula: nuevaFormula } });
    console.log(`Fórmula corregida en el lugar: "${vigenteActual.formula}" → "${nuevaFormula}"`);
  } else {
    await prisma.reglaConcepto.create({
      data: { conceptoId: remBasica.id, convenioId: convenio.id, vigenciaDesde: new Date("2026-01-01"), formula: nuevaFormula, aporta: true, contribuye: true },
    });
    console.log(`No había ninguna regla de REM_BASICA para Madera — se creó una nueva: "${nuevaFormula}"`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
