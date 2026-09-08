// FM RRHH — prisma/crear-quincenas-julio-madera.ts
// Crea "1ra. Quincena Julio 2026" y "2da. Quincena Julio 2026", en
// paralelo al "Julio 2026" mensual que ya usa Comercio — pensadas para
// liquidar Madera con horas reales cargadas por novedad (ver
// 63-novedades-horas-reales.md), filtrando por convenio en /liquidar.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const empresas = await prisma.empresa.findMany();
  if (empresas.length !== 1) { console.log(`Hay ${empresas.length} empresas — creá esto desde /periodos a mano.`); return; }
  const empresa = empresas[0];

  const periodos = [
    { nombre: "1ra. Quincena Julio 2026", fechaDesde: "2026-07-01", fechaHasta: "2026-07-15" },
    { nombre: "2da. Quincena Julio 2026", fechaDesde: "2026-07-16", fechaHasta: "2026-07-31" },
  ];

  for (const p of periodos) {
    const existente = await prisma.periodo.findFirst({ where: { empresaId: empresa.id, nombre: p.nombre } });
    if (existente) { console.log(`Ya existe "${p.nombre}" — no se creó de nuevo.`); continue; }
    const creado = await prisma.periodo.create({
      data: { empresaId: empresa.id, nombre: p.nombre, fechaDesde: new Date(p.fechaDesde), fechaHasta: new Date(p.fechaHasta), estado: "borrador" },
    });
    console.log(`✔ "${p.nombre}" creado (id: ${creado.id}).`);
  }

  console.log("\nPara liquidar: en /liquidar, elegí la quincena, filtrá 'Por convenio' → Madera.");
  console.log("Comercio sigue liquidándose en el 'Julio 2026' mensual de siempre, sin tocar nada.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
