// FM RRHH — prisma/cargar-domicilio-empresa.ts
// El recibo Ley 27.802 necesita el domicilio de la empresa (para el
// encabezado y el "lugar de pago"). Completá acá si hace falta actualizarlo
// — Moras ya viene con el domicilio conocido de exploraciones anteriores.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOMICILIO_MORAS = "Leonardo Euler 2342, Grand Bourg (1615), Buenos Aires";

async function main() {
  let empresa = await prisma.empresa.findFirst({ where: { cuit: "30-64523406-1" } });

  if (!empresa) {
    // El CUIT puede estar guardado en otro formato (sin guiones, etc.) —
    // probamos por nombre antes de rendirnos.
    empresa = await prisma.empresa.findFirst({ where: { razonSocial: { contains: "Moras", mode: "insensitive" } } });
  }

  if (!empresa) {
    const todas = await prisma.empresa.findMany();
    if (todas.length === 1) {
      empresa = todas[0];
      console.log(`No encontré "Moras" por CUIT ni por nombre, pero hay una sola empresa cargada ("${empresa.razonSocial}") — uso esa.`);
    }
  }

  if (!empresa) { console.log("No se encontró la empresa Moras (ni por CUIT, ni por nombre, y hay más de una empresa cargada) — revisá /empresas a mano."); return; }

  if (empresa.domicilio === DOMICILIO_MORAS) {
    console.log("El domicilio ya estaba cargado — sin cambios.");
    return;
  }

  await prisma.empresa.update({ where: { id: empresa.id }, data: { domicilio: DOMICILIO_MORAS } });
  console.log(`✔ Domicilio cargado: ${DOMICILIO_MORAS}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
