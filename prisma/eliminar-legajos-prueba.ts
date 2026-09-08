// FM RRHH — prisma/eliminar-legajos-prueba.ts
// Elimina los 5 legajos ficticios que se usaron para probar todo el sistema
// (Retamar, Bassi, Ferreyra, Duarte, Coria — números 4, 7, 12, 15, 20) junto
// con todo lo que dependía de ellos: liquidaciones, detalle de liquidación,
// vacaciones, novedades. No toca nada de la empresa, los períodos, ni el
// catálogo (convenios/categorías/escalas/conceptos) — eso queda intacto.
//
// Se corre UNA vez, antes de importar los 125 empleados reales, porque el
// legajo 4 real (CHOUSA) choca en número con el "Retamar" de prueba.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NUMEROS_DE_PRUEBA = [4, 7, 12, 15, 20];

async function main() {
  const empresa = await prisma.empresa.findFirst();
  if (!empresa) { console.log("No hay ninguna empresa cargada."); return; }

  const legajos = await prisma.legajo.findMany({
    where: { empresaId: empresa.id, numeroLegajo: { in: NUMEROS_DE_PRUEBA } },
  });

  if (legajos.length === 0) {
    console.log("No se encontró ningún legajo de prueba (4, 7, 12, 15, 20) — no había nada que borrar.");
    return;
  }

  console.log(`Legajos de prueba encontrados: ${legajos.map((l) => `${l.numeroLegajo} (${l.apellido})`).join(", ")}`);

  const legajoIds = legajos.map((l) => l.id);

  const liquidaciones = await prisma.liquidacion.findMany({ where: { legajoId: { in: legajoIds } } });
  const liquidacionIds = liquidaciones.map((l) => l.id);

  const detalle = await prisma.liquidacionDetalle.deleteMany({ where: { liquidacionId: { in: liquidacionIds } } });
  console.log(`✔ ${detalle.count} líneas de detalle de liquidación eliminadas.`);

  const liq = await prisma.liquidacion.deleteMany({ where: { id: { in: liquidacionIds } } });
  console.log(`✔ ${liq.count} liquidaciones eliminadas.`);

  const vac = await prisma.vacacion.deleteMany({ where: { legajoId: { in: legajoIds } } });
  console.log(`✔ ${vac.count} registros de vacaciones eliminados.`);

  const nov = await prisma.novedad.deleteMany({ where: { legajoId: { in: legajoIds } } });
  console.log(`✔ ${nov.count} novedades eliminadas.`);

  const leg = await prisma.legajo.deleteMany({ where: { id: { in: legajoIds } } });
  console.log(`✔ ${leg.count} legajos de prueba eliminados.`);

  console.log("\nListo — la empresa, los períodos, y todo el catálogo (convenios, categorías, escalas, conceptos) quedaron intactos.");
  console.log("Ahora sí se puede correr la importación de los 125 empleados reales.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
