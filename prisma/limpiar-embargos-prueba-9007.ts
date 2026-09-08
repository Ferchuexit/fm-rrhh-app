// FM RRHH — prisma/limpiar-embargos-prueba-9007.ts
//
// El diagnóstico del 08/09/2026 mostró varios Embargo duplicados/con datos
// inconsistentes para el legajo 9007 (probablemente de intentos de carga
// repetidos mientras se probaba la pantalla) — con eso, ningún embargo
// comercial podía aplicar: uno sin cuota de agosto, el otro con la cuota
// ya marcada aplicado=true.
//
// Este script BORRA todos los Embargo (y sus CuotaEmbargo) del legajo 9007
// y deja uno judicial + uno comercial, limpios, con una cuota de agosto
// 2026 sin aplicar — listo para probar la liquidación de punta a punta.
// SOLO toca el legajo 9007 (empresa de prueba) — no toca nada de Moras.
//
// Uso: npx tsx prisma/limpiar-embargos-prueba-9007.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const legajo = await prisma.legajo.findFirst({ where: { numeroLegajo: 9007 }, include: { empresa: true } });
  if (!legajo) { console.log("✕ No existe el legajo 9007."); return; }
  if (!legajo.empresa.razonSocial.toLowerCase().includes("prueba")) {
    console.log(`✕ El legajo 9007 pertenece a "${legajo.empresa.razonSocial}", que no parece ser la empresa de prueba — no toco nada, revisá a mano.`);
    return;
  }

  const embargosViejos = await prisma.embargo.findMany({ where: { legajoId: legajo.id } });
  console.log(`Encontrados ${embargosViejos.length} embargo(s) viejo(s) para el legajo 9007 — borrando...`);

  for (const e of embargosViejos) {
    await prisma.cuotaEmbargo.deleteMany({ where: { embargoId: e.id } });
  }
  await prisma.embargo.deleteMany({ where: { legajoId: legajo.id } });

  const judicial = await prisma.embargo.create({
    data: {
      legajoId: legajo.id,
      tipo: "judicial",
      descripcion: "Cuota alimentaria de prueba",
      fechaInicio: new Date("2026-01-01"),
      fechaFin: null,
      activo: true,
      porcentaje: 40,
    },
  });
  console.log(`✔ Judicial creado — 40% sobre el neto, activo.`);

  const comercial = await prisma.embargo.create({
    data: {
      legajoId: legajo.id,
      tipo: "comercial",
      descripcion: "Deuda de prueba",
      fechaInicio: new Date("2026-01-01"),
      fechaFin: null,
      activo: true,
      montoTotal: 900000,
    },
  });
  await prisma.cuotaEmbargo.create({
    data: { embargoId: comercial.id, anio: 2026, mes: 8, importe: 75000, aplicado: false },
  });
  console.log(`✔ Comercial creado — $900.000 total, cuota de agosto 2026: $75.000, sin aplicar todavía.`);

  console.log("\nListo. Ahora hace falta volver a liquidar agosto 2026 para este legajo (la liquidación vigente");
  console.log("actual se calculó contra los datos viejos) — desde /liquidacion-masiva, filtro \"Por legajo\", 9007.");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
