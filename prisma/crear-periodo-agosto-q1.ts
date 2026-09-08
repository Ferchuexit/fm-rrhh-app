// FM RRHH — prisma/crear-periodo-agosto-q1.ts
// Crea "1ra. Quincena Agosto 2026" para probar el liquidador con novedades
// reales — mismo mecanismo que ya usás en /periodos, hecho por script
// porque lo pediste directo en el chat.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const empresas = await prisma.empresa.findMany();
  if (empresas.length !== 1) { console.log(`Hay ${empresas.length} empresas — corré esto desde /periodos a mano, para elegir cuál.`); return; }
  const empresa = empresas[0];

  const nombre = "1ra. Quincena Agosto 2026";
  const existente = await prisma.periodo.findFirst({ where: { empresaId: empresa.id, nombre } });
  if (existente) { console.log(`Ya existe "${nombre}" — no se creó de nuevo.`); return; }

  const periodo = await prisma.periodo.create({
    data: {
      empresaId: empresa.id,
      nombre,
      fechaDesde: new Date("2026-08-01"),
      fechaHasta: new Date("2026-08-15"),
      estado: "borrador",
    },
  });
  console.log(`✔ Período "${nombre}" creado (id: ${periodo.id}).`);
  console.log("\nAhora podés:");
  console.log(`  1. Importar novedades reales en /novedades?periodoId=${periodo.id}`);
  console.log(`  2. Liquidar en /liquidar?periodoId=${periodo.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
