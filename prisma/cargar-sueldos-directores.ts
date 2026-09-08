// FM RRHH — prisma/cargar-sueldos-directores.ts
//
// ⚠️ ANTES DE CORRER ESTO: reemplazá los 0 de abajo por el sueldo básico
// mensual real de cada director. No se inventó ningún número — mismo
// criterio que con Peón: nunca calcular con un valor que no tenemos.
//
// Corré crear-categorias-directores.ts PRIMERO (una sola vez).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUELDOS = [
  { numeroLegajo: 180, basicoMensual: 0 }, // MORAS, RUBÉN VICTOR — completar
  { numeroLegajo: 181, basicoMensual: 0 }, // TALEVI, PATRICIA STELA — completar
  { numeroLegajo: 316, basicoMensual: 0 }, // MORAS, JUAN CRUZ — completar
];

const VIGENCIA_DESDE = new Date("2026-07-01");

async function main() {
  if (SUELDOS.some((s) => s.basicoMensual === 0)) {
    console.log("⚠ Todavía hay sueldos en 0 — completá los montos reales en este archivo antes de correrlo.");
    console.log("(Se detiene acá a propósito, para no cargar un básico de $0 por error.)");
    return;
  }

  const convenio = await prisma.convenio.findUnique({ where: { codigo: "9999/99" } });
  if (!convenio) { console.log('No se encontró el convenio "9999/99".'); return; }

  // El convenio Excluido todavía no tenía ninguna regla — se crea acá, con
  // el mismo criterio que Comercio (básico mensual fijo, no por hora: los
  // directores no fichan horas, tienen un sueldo mensual negociado).
  const remBasica = await prisma.concepto.findUnique({ where: { codigo: "REM_BASICA" } });
  if (remBasica) {
    const reglaExistente = await prisma.reglaConcepto.findFirst({ where: { conceptoId: remBasica.id, convenioId: convenio.id, vigenciaHasta: null } });
    if (!reglaExistente) {
      await prisma.reglaConcepto.create({
        data: { conceptoId: remBasica.id, convenioId: convenio.id, vigenciaDesde: VIGENCIA_DESDE, formula: "BASICO", aporta: true, contribuye: true },
      });
      console.log('✔ Regla de básico creada para el convenio Excluido (9999/99) — no existía ninguna.');
    }
  }

  for (const s of SUELDOS) {
    const legajo = await prisma.legajo.findFirst({ where: { numeroLegajo: s.numeroLegajo }, include: { categoria: true } });
    if (!legajo) { console.log(`Legajo ${s.numeroLegajo}: no existe — se salta.`); continue; }

    const yaExiste = await prisma.escala.findFirst({ where: { categoriaId: legajo.categoriaId, vigenciaDesde: VIGENCIA_DESDE } });
    if (yaExiste) { console.log(`Legajo ${s.numeroLegajo}: ya tenía una escala cargada para esta fecha — no se tocó.`); continue; }

    await prisma.escala.create({
      data: { convenioId: convenio.id, categoriaId: legajo.categoriaId, vigenciaDesde: VIGENCIA_DESDE, basico: s.basicoMensual, valorHora: 0 },
    });
    console.log(`✔ Sueldo de ${legajo.apellido}, ${legajo.nombre} (legajo ${s.numeroLegajo}) cargado: $${s.basicoMensual}.`);
  }

  console.log("\nListo. Los 3 directores ya pueden liquidarse.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
