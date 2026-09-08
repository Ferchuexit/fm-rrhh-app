// FM RRHH — prisma/limpiar-escalas-duplicadas.ts
// Correr import-catalogo-real.ts varias veces (necesario para ir agregando
// categorías que faltaban) dejó algunas filas de Escala duplicadas: misma
// categoría, misma fecha de vigencia exacta, mismo valor — el chequeo
// "ya existe" del importador compara con igualdad exacta de fecha, y una
// diferencia de milisegundos entre corridas alcanza para que no la
// reconozca como duplicada. Esto NO es la causa de los legajos sin
// liquidar (findFirst().orderBy() igual encuentra una válida entre varias
// duplicadas) — es prolijidad de la base, no un bug funcional. Se limpia
// igual, para que la tabla no quede confusa de mirar.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const escalas = await prisma.escala.findMany({ orderBy: { vigenciaDesde: "asc" } });

  const vistos = new Map<string, string>(); // clave "categoriaId|díaISO" -> id de la primera que se guarda
  const aBorrar: string[] = [];

  for (const e of escalas) {
    const clave = `${e.categoriaId}|${e.vigenciaDesde.toISOString().slice(0, 10)}`;
    if (vistos.has(clave)) {
      aBorrar.push(e.id);
    } else {
      vistos.set(clave, e.id);
    }
  }

  if (aBorrar.length === 0) {
    console.log("No había ninguna fila duplicada.");
    return;
  }

  await prisma.escala.deleteMany({ where: { id: { in: aBorrar } } });
  console.log(`✔ ${aBorrar.length} filas duplicadas eliminadas (de ${escalas.length} totales — quedan ${escalas.length - aBorrar.length}).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
