// FM RRHH — prisma/diagnostico-periodos-duplicados.ts
//
// Busca Periodo con nombres parecidos o el mismo rango de fechas — para
// confirmar si lo que se ve como "liquidaciones duplicadas" en realidad
// son varios PERÍODOS distintos representando el mismo mes.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const periodos = await prisma.periodo.findMany({
    orderBy: [{ empresaId: "asc" }, { fechaDesde: "asc" }],
    include: { _count: { select: { liquidaciones: true } } },
  });

  console.log(`Total de períodos en la base: ${periodos.length}\n`);
  for (const p of periodos) {
    console.log(`"${p.nombre}" — ${p.fechaDesde.toISOString().slice(0, 10)} a ${p.fechaHasta.toISOString().slice(0, 10)} — estado=${p.estado} — ${p._count.liquidaciones} liquidación(es) — id=${p.id}`);
  }

  const porFechas = new Map<string, typeof periodos>();
  for (const p of periodos) {
    const clave = `${p.empresaId}__${p.fechaDesde.toISOString().slice(0, 10)}__${p.fechaHasta.toISOString().slice(0, 10)}`;
    if (!porFechas.has(clave)) porFechas.set(clave, []);
    porFechas.get(clave)!.push(p);
  }
  const repetidos = [...porFechas.entries()].filter(([, ps]) => ps.length > 1);
  if (repetidos.length > 0) {
    console.log(`\n⚠ Hay ${repetidos.length} rango(s) de fechas con MÁS DE UN período creado para la misma empresa:`);
    for (const [, ps] of repetidos) {
      console.log(`  ${ps.map((p) => `"${p.nombre}" (id=${p.id})`).join(" / ")}`);
    }
  }
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
