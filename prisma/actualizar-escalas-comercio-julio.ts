// FM RRHH — prisma/actualizar-escalas-comercio-julio.ts
// Los básicos de Comercio que teníamos cargados (del Excel original) eran
// de ANTES de la "Revisión Julio 2026" — la tabla real que compartiste
// (y el ejemplo de Intercec para Administrativo B) confirman valores
// distintos. Este script ACTUALIZA (no crea nuevas filas) las 21 escalas
// de Comercio ya vigentes desde el 1° de julio, con los básicos correctos.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Nombre tal cual aparece en tu tabla -> nombre real en la base (algunos
// difieren en singular/plural).
const BASICOS_JULIO: { categoria: string; basico: number }[] = [
  { categoria: "MAESTRANZA A", basico: 1137023 },
  { categoria: "MAESTRANZA B", basico: 1140294 },
  { categoria: "MAESTRANZA C", basico: 1151751 },
  { categoria: "ADMINISTRATIVO A", basico: 1149298 },
  { categoria: "ADMINISTRATIVO B", basico: 1154212 },
  { categoria: "ADMINISTRATIVO C", basico: 1159120 },
  { categoria: "ADMINISTRATIVO D", basico: 1173854 },
  { categoria: "ADMINISTRATIVO E", basico: 1186128 },
  { categoria: "ADMINISTRATIVO F", basico: 1204135 },
  { categoria: "CAJERO A", basico: 1153389 }, // tabla: "Cajeros A"
  { categoria: "CAJERO B", basico: 1159120 },
  { categoria: "CAJERO C", basico: 1166487 },
  { categoria: "PERSONAL AUXILIAR A", basico: 1153389 },
  { categoria: "PERSONAL AUXILIAR B", basico: 1161573 },
  { categoria: "PERSONAL AUXILIAR C", basico: 1188584 },
  { categoria: "AUXILIAR ESPECIALIZADO A", basico: 1163214 },
  { categoria: "AUXILIAR ESPECIALIZADO B", basico: 1177944 },
  { categoria: "VENDEDORES A", basico: 1153389 },
  { categoria: "VENDEDORES B", basico: 1177947 },
  { categoria: "VENDEDORES C", basico: 1186128 },
  { categoria: "VENDEDORES D", basico: 1204135 },
];

const VIGENCIA_DESDE = new Date("2026-07-01");

async function main() {
  const convenio = await prisma.convenio.findUnique({ where: { codigo: "0130/75" } });
  if (!convenio) { console.log('No se encontró el convenio "0130/75".'); return; }

  let actualizadas = 0, sinCategoria = 0, sinEscalaJulio = 0;

  for (const b of BASICOS_JULIO) {
    const categoria = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, nombre: b.categoria } });
    if (!categoria) { console.log(`⚠ Categoría "${b.categoria}" no existe — se salta.`); sinCategoria++; continue; }

    const escala = await prisma.escala.findFirst({ where: { categoriaId: categoria.id, vigenciaDesde: VIGENCIA_DESDE } });
    if (!escala) { console.log(`⚠ "${b.categoria}" no tiene escala vigente al 1° de julio todavía — se salta.`); sinEscalaJulio++; continue; }

    if (escala.basico.toNumber() === b.basico) { console.log(`"${b.categoria}": ya estaba en $${b.basico} — sin cambios.`); continue; }

    console.log(`✔ "${b.categoria}": $${escala.basico.toNumber().toLocaleString("es-AR")} → $${b.basico.toLocaleString("es-AR")}`);
    await prisma.escala.update({ where: { id: escala.id }, data: { basico: b.basico } });
    actualizadas++;
  }

  console.log(`\n${actualizadas} actualizadas, ${sinCategoria} sin categoría, ${sinEscalaJulio} sin escala de julio.`);
  console.log("\n⚠️ Esto cambia el neto de todos los legajos de Comercio ya liquidados en julio.");
  console.log("Volvé a liquidar desde /liquidacion-masiva (filtrando por convenio Comercio) para que quede actualizado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
