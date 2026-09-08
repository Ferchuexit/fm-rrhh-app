// FM RRHH — prisma/diagnostico-vigentes-duplicadas.ts
//
// Busca casos donde un mismo legajo+período tiene MÁS DE UNA Liquidacion
// con vigente=true a la vez — esto nunca debería pasar (la regla es "una
// sola vigente por legajo+período"), pero una condición de carrera
// (liquidar disparado dos veces casi al mismo tiempo) puede romperla.
// Este script SOLO diagnostica, no corrige nada todavía.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const vigentes = await prisma.liquidacion.findMany({
    where: { vigente: true },
    include: { legajo: { select: { numeroLegajo: true, apellido: true } }, periodo: { select: { nombre: true } } },
  });

  const porLegajoPeriodo = new Map<string, typeof vigentes>();
  for (const v of vigentes) {
    const clave = `${v.legajoId}__${v.periodoId}`;
    if (!porLegajoPeriodo.has(clave)) porLegajoPeriodo.set(clave, []);
    porLegajoPeriodo.get(clave)!.push(v);
  }

  const duplicados = [...porLegajoPeriodo.entries()].filter(([, filas]) => filas.length > 1);

  if (duplicados.length === 0) {
    console.log("No se encontró ningún caso de más de una liquidación vigente para el mismo legajo+período. El problema es otra cosa.");
    return;
  }

  console.log(`Encontrados ${duplicados.length} caso(s) de legajo+período con más de una liquidación vigente=true a la vez:\n`);
  for (const [, filas] of duplicados) {
    const primero = filas[0];
    console.log(`Legajo #${primero.legajo.numeroLegajo} ${primero.legajo.apellido} — ${primero.periodo.nombre}:`);
    for (const f of filas) {
      console.log(`  - id=${f.id} version=${f.version} bruto=${f.bruto} neto=${f.neto} fechaCalculo=${f.fechaCalculo.toISOString()}`);
    }
  }
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
