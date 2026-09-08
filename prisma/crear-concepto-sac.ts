// FM RRHH — prisma/crear-concepto-sac.ts
//
// Dos conceptos, no uno — el LSD de ARCA exige distinguir SAC de semestre
// completo (120000) de SAC proporcional (120003), con reglas de tope
// distintas (Guía N°28 LSD, arca.gob.ar). Se crean los dos con su código
// ARCA correcto desde el principio, mismo criterio que ya usamos con
// Embargos — no repetir el hueco de RETENCION_GANANCIAS (concepto sin
// código ARCA hasta que rompió el LSD en producción).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONCEPTOS = [
  { codigo: "SAC", numero: 90003, nombre: "Sueldo Anual Complementario (semestre completo)", codigoArca: "120000" },
  { codigo: "SAC_PROPORCIONAL", numero: 90004, nombre: "SAC Proporcional (semestre incompleto)", codigoArca: "120003" },
];

async function main() {
  for (const c of CONCEPTOS) {
    const existente = await prisma.concepto.findUnique({ where: { codigo: c.codigo } });
    if (existente) {
      console.log(`"${c.codigo}" ya existía — sin cambios.`);
      continue;
    }
    await prisma.concepto.create({
      data: {
        codigo: c.codigo, numero: c.numero, nombre: c.nombre,
        tipo: "remunerativo", unidad: "monto", categoriaNovedad: "Otros",
        codigoArca: c.codigoArca,
      },
    });
    console.log(`✔ Concepto creado: ${c.codigo} (ARCA ${c.codigoArca})`);
  }
  console.log("\nPendiente para cuando se conecte esto al export de LSD: el código 120003 (proporcional)");
  console.log("exige informar en el campo 'Cantidad' los días trabajados en el semestre — no está");
  console.log("cableado todavía en motor-exportacion-lsd.mjs, solo el cálculo del importe en sí.");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
