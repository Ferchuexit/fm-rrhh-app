// FM RRHH — prisma/fix-zona-horaria-escalas.ts
// Corrige un bug real: las fechas de vigencia de las escalas importadas en
// import-catalogo-real.ts se generaron en Python sin zona horaria
// ("2026-07-01T00:00:00", sin "Z"). Node, al leerlas en una máquina que
// corre en horario de Argentina (UTC-3), las interpreta como medianoche
// HORA LOCAL — que en UTC son las 3 de la mañana, tres horas después de la
// medianoche UTC real. Por esas tres horas, una escala vigente "desde el
// 1° de julio" quedaba registrada como vigente recién desde las 3am del
// 1° de julio en UTC, y la comparación contra el inicio del período
// (medianoche UTC exacta) fallaba por un pelo.
//
// Este script relee cada fecha con los métodos LOCALES de JavaScript
// (que en tu máquina "ven" la fecha corrida de vuelta a como se quiso decir
// originalmente) y la vuelve a guardar como medianoche UTC real — sin
// asumir ninguna zona horaria en particular, funciona corriéndolo en la
// misma máquina/zona horaria que causó el problema.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const escalas = await prisma.escala.findMany();
  let corregidas = 0;

  for (const e of escalas) {
    // Reconstruye la fecha usando los componentes LOCALES (año/mes/día tal
    // como se ven en esta máquina) y los vuelve a armar como medianoche UTC.
    const corregida = new Date(Date.UTC(e.vigenciaDesde.getFullYear(), e.vigenciaDesde.getMonth(), e.vigenciaDesde.getDate()));

    if (corregida.getTime() !== e.vigenciaDesde.getTime()) {
      await prisma.escala.update({ where: { id: e.id }, data: { vigenciaDesde: corregida } });
      corregidas++;
    }
  }

  console.log(`✔ ${corregidas} de ${escalas.length} escalas corregidas (las que ya estaban bien no se tocaron).`);
  console.log("Probá liquidar de nuevo — la escala de Comercio ya debería encontrarse.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
