// FM RRHH — prisma/cambiar-relacion-laboral.ts
//
// Usar CADA VEZ que un empleado cambia de convenio y/o categoría (ascenso,
// reencasillamiento, pase a Excluidos, etc.). Hace DOS cosas atómicamente:
//
//   1. Cierra (vigenciaHasta) la RelacionLaboral vigente del legajo.
//   2. Crea la nueva RelacionLaboral vigente.
//   3. Actualiza Legajo.convenioId/categoriaId al nuevo valor — esto es
//      importante: el motor de liquidación (app/api/liquidar/route.ts) y
//      las 26 pantallas del sistema siguen leyendo estos dos campos
//      directo del legajo, así que si no se sincronizan acá, el cambio
//      "no se nota" en la próxima liquidación.
//
// Uso:
//   npx tsx prisma/cambiar-relacion-laboral.ts <numeroLegajo> <codigoConvenio> <codigoCategoria> <fechaDesde YYYY-MM-DD> [motivo]
//
// Ejemplo:
//   npx tsx prisma/cambiar-relacion-laboral.ts 125 0130/75 "Administrativo B" 2026-09-01 "ascenso"
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [numeroLegajoStr, codigoConvenio, nombreCategoria, fechaDesdeStr, motivo] = process.argv.slice(2);

  if (!numeroLegajoStr || !codigoConvenio || !nombreCategoria || !fechaDesdeStr) {
    console.error(
      "Uso: npx tsx prisma/cambiar-relacion-laboral.ts <numeroLegajo> <codigoConvenio> <nombreCategoria> <fechaDesde YYYY-MM-DD> [motivo]"
    );
    process.exit(1);
  }

  const numeroLegajo = parseInt(numeroLegajoStr, 10);
  const fechaDesde = new Date(fechaDesdeStr);

  const legajo = await prisma.legajo.findFirst({ where: { numeroLegajo } });
  if (!legajo) {
    console.error(`No se encontró ningún legajo con numeroLegajo = ${numeroLegajo}.`);
    process.exit(1);
  }

  const convenio = await prisma.convenio.findUnique({ where: { codigo: codigoConvenio } });
  if (!convenio) {
    console.error(`No se encontró convenio con código = "${codigoConvenio}".`);
    process.exit(1);
  }

  const categoria = await prisma.categoria.findFirst({
    where: { convenioId: convenio.id, nombre: nombreCategoria },
  });
  if (!categoria) {
    console.error(`No se encontró la categoría "${nombreCategoria}" dentro del convenio "${convenio.nombre}".`);
    process.exit(1);
  }

  const vigente = await prisma.relacionLaboral.findFirst({
    where: { legajoId: legajo.id, vigenciaHasta: null },
  });

  await prisma.$transaction(async (tx) => {
    if (vigente) {
      await tx.relacionLaboral.update({
        where: { id: vigente.id },
        data: { vigenciaHasta: fechaDesde },
      });
    }

    await tx.relacionLaboral.create({
      data: {
        legajoId: legajo.id,
        convenioId: convenio.id,
        categoriaId: categoria.id,
        vigenciaDesde: fechaDesde,
        vigenciaHasta: null,
        motivo: motivo ?? null,
      },
    });

    await tx.legajo.update({
      where: { id: legajo.id },
      data: { convenioId: convenio.id, categoriaId: categoria.id },
    });
  });

  console.log(
    `Legajo ${numeroLegajo} (${legajo.apellido}, ${legajo.nombre}): ` +
      `${vigente ? "relación anterior cerrada, " : ""}nueva relación creada — ` +
      `${convenio.nombre} / ${categoria.nombre}, vigente desde ${fechaDesdeStr}. ` +
      `Legajo sincronizado.`
  );
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
