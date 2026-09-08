// FM RRHH — prisma/fix-tipo-redondeo.ts
// Redondeo quedó con tipo "descuento" en vez de "no_remunerativo" — no sé
// exactamente en qué paso pasó, pero el efecto es claro y ya confirmado en
// el sandbox: con el tipo equivocado, un ajuste negativo se resta como si
// fuera positivo, empujando el neto en la dirección contraria a la que
// tiene que ir (ver 72-fix-redondeo.md). Se corrige el tipo del concepto,
// una sola fila, no toca fórmulas ni reglas.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const redondeo = await prisma.concepto.findUnique({ where: { codigo: "REDONDEO" } });
  if (!redondeo) { console.log('No se encontró el concepto "REDONDEO".'); return; }

  console.log(`Tipo actual: "${redondeo.tipo}"`);
  if (redondeo.tipo === "no_remunerativo") {
    console.log("Ya está correcto — sin cambios.");
    return;
  }

  await prisma.concepto.update({ where: { id: redondeo.id }, data: { tipo: "no_remunerativo" } });
  console.log('✔ Corregido: "REDONDEO" ahora es tipo "no_remunerativo".');
  console.log("\n⚠️ Esto cambia el neto de TODOS los legajos ya liquidados (en los tres convenios).");
  console.log("Volvé a liquidar todos los períodos para que los netos queden correctamente redondeados.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
