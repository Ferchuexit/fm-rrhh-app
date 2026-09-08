// FM RRHH — prisma/marcar-legajos-obra.ts
//
// Marca fichadaObligatoria=false para el personal de obra que arranca
// directo en el sitio de trabajo y ficha solo eventualmente — confirmado
// por Fernando (gerente de RR.HH.), lista fija de 17 legajos.
//
// Para el personal de planta que ocasionalmente va a una obra "con previo
// aviso" (mencionado aparte, no es una lista fija) — no se puede
// automatizar sin saber cuándo pasa. Para esos casos puntuales usar
// prisma/toggle-fichada-obligatoria.ts, que prende/apaga el flag para UN
// legajo a la vez, cuando corresponda.
//
// No destructivo: si ya estaba marcado, no hace nada.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGAJOS_OBRA = [
  57, 88, 104, 237, 401, 428, 479, 375, 127, 134, 178, 432, 273, 461, 467, 92, 72,
];

async function main() {
  let actualizados = 0, yaEstaban = 0, noEncontrados: number[] = [];

  for (const numeroLegajo of LEGAJOS_OBRA) {
    const legajo = await prisma.legajo.findFirst({ where: { numeroLegajo } });
    if (!legajo) { noEncontrados.push(numeroLegajo); continue; }

    if (legajo.fichadaObligatoria === false) { yaEstaban++; continue; }

    await prisma.legajo.update({ where: { id: legajo.id }, data: { fichadaObligatoria: false } });
    console.log(`✔ Legajo ${numeroLegajo} (${legajo.apellido}, ${legajo.nombre}): marcado como obra (fichada no obligatoria).`);
    actualizados++;
  }

  console.log(`\nListo. Actualizados: ${actualizados}. Ya estaban marcados: ${yaEstaban}.`);
  if (noEncontrados.length > 0) {
    console.log(`⚠ No se encontraron estos números de legajo en la base: ${noEncontrados.join(", ")}`);
  }
  console.log(`\nSi corrés clasificar-asistencia.ts de nuevo, los días sin fichada de estos legajos van a pasar de 'A' a 'SIN_CONTROL'.`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
