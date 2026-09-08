// FM RRHH — prisma/crear-categorias-directores.ts
// Los 3 directores (Moras Rubén Víctor, Talevi Patricia Stela, Moras Juan
// Cruz) están bajo "Excluido de Convenio" (9999/99) con la categoría
// compartida "SIN CATEGORIA" — que a propósito no tiene escala (sueldo
// individual, no hay un básico único que aplique a los tres). Este script
// les crea una categoría PROPIA a cada uno y les reasigna el legajo — el
// paso siguiente (cargar el sueldo real de cada uno) es
// cargar-sueldos-directores.ts, aparte, porque necesita que completes los
// montos reales primero.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DIRECTORES = [
  { numeroLegajo: 180, nombreCategoria: "DIRECTOR — MORAS, RUBÉN VICTOR" },
  { numeroLegajo: 181, nombreCategoria: "DIRECTOR — TALEVI, PATRICIA STELA" },
  { numeroLegajo: 316, nombreCategoria: "DIRECTOR — MORAS, JUAN CRUZ" },
];

async function main() {
  const convenio = await prisma.convenio.findUnique({ where: { codigo: "9999/99" } });
  if (!convenio) { console.log('No se encontró el convenio "9999/99" (Excluido).'); return; }

  for (const d of DIRECTORES) {
    const legajo = await prisma.legajo.findFirst({ where: { numeroLegajo: d.numeroLegajo } });
    if (!legajo) { console.log(`Legajo ${d.numeroLegajo}: no existe — se salta.`); continue; }

    let categoria = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, nombre: d.nombreCategoria } });
    if (!categoria) {
      categoria = await prisma.categoria.create({ data: { convenioId: convenio.id, codigo: d.nombreCategoria.slice(0, 20), nombre: d.nombreCategoria } });
      console.log(`✔ Categoría "${d.nombreCategoria}" creada.`);
    } else {
      console.log(`La categoría "${d.nombreCategoria}" ya existía.`);
    }

    if (legajo.categoriaId !== categoria.id) {
      await prisma.legajo.update({ where: { id: legajo.id }, data: { categoriaId: categoria.id } });
      console.log(`✔ Legajo ${d.numeroLegajo} reasignado a su categoría propia.`);
    }
  }

  console.log("\nListo. Todavía falta cargar el sueldo real de cada uno —");
  console.log("completá los montos en cargar-sueldos-directores.ts y corrélo después.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
