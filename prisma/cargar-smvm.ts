// FM RRHH — prisma/cargar-smvm.ts
// SMVM (Salario Mínimo, Vital y Móvil) — se usa para el tope legal del
// embargo comercial (Decreto 484/87). Se actualiza varias veces al año
// (Resolución 9/2025 del Consejo del Salario) — mismo mecanismo que
// TOPE_JUBILATORIO, un ParametroVigente por fecha.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [vigenciaDesde, valor, fuente]
const VALORES_SMVM: [string, number, string][] = [
  ["2026-07-01", 372400, "Resolución 9/2025, Consejo del Salario — SMVM julio 2026"],
  ["2026-08-01", 376600, "Resolución 9/2025, Consejo del Salario — SMVM agosto 2026"],
];

async function main() {
  for (const [fecha, valor, fuente] of VALORES_SMVM) {
    const vigenciaDesde = new Date(fecha);
    const yaExiste = await prisma.parametroVigente.findFirst({ where: { clave: "SMVM", vigenciaDesde } });
    if (yaExiste) {
      console.log(`SMVM desde ${fecha} ya estaba cargado ($${yaExiste.valor}) — sin cambios.`);
      continue;
    }
    await prisma.parametroVigente.create({ data: { clave: "SMVM", valor, vigenciaDesde, fuente } });
    console.log(`✔ SMVM desde ${fecha}: $${valor.toLocaleString("es-AR")}`);
  }
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
