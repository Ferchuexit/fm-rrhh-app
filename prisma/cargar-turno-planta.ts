// FM RRHH — prisma/cargar-turno-planta.ts
//
// Carga el turno GENERAL de planta como fallback por convenio: Lunes a
// Viernes, 07:00 a 17:00 — confirmado contra la hoja "Cronograma Planta" de
// tu Excel real (21 fechas revisadas, todas L-V, todas el mismo horario:
// ningún feriado ni jornada reducida especial en los datos que tengo).
//
// OJO — esto es el fallback POR CONVENIO. Vi en tu hoja "Llegadas Tarde"
// que algunos legajos (189, 202, 415) tienen horario de ingreso 06:00, no
// 07:00 — Turno.legajoId permite cargar esa excepción por legajo cuando me
// confirmes cuáles son y bajo qué criterio (¿todo un convenio entra antes,
// o son legajos puntuales?). Este script NO adivina eso — carga solo el
// horario general confirmado.
//
// No destructivo: si ya hay un turno vigente para ese convenio+día, no lo
// duplica.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VIGENCIA_DESDE = new Date("2026-01-01");

// 1=lunes .. 5=viernes (0=domingo, 6=sábado — no se cargan, son franco)
const DIAS_LABORABLES = [1, 2, 3, 4, 5];
const CONVENIOS = ["0335/75", "0130/75", "9999/99"]; // Madera, Comercio, Excluidos

async function main() {
  let creados = 0, saltados = 0;

  for (const codigoConvenio of CONVENIOS) {
    const convenio = await prisma.convenio.findUnique({ where: { codigo: codigoConvenio } });
    if (!convenio) { console.log(`⚠ No existe el convenio "${codigoConvenio}" — se salta.`); continue; }

    for (const diaSemana of DIAS_LABORABLES) {
      const yaExiste = await prisma.turno.findFirst({
        where: { convenioId: convenio.id, legajoId: null, diaSemana, vigenciaHasta: null },
      });
      if (yaExiste) { saltados++; continue; }

      await prisma.turno.create({
        data: {
          convenioId: convenio.id,
          legajoId: null,
          diaSemana,
          horaIngreso: "07:00",
          horaSalida: "17:00",
          vigenciaDesde: VIGENCIA_DESDE,
        },
      });
      creados++;
    }
    console.log(`✔ ${codigoConvenio}: turno L-V 07:00-17:00 cargado.`);
  }

  console.log(`\nListo. Turnos creados: ${creados}. Ya existían (saltados): ${saltados}.`);
  console.log("Sábado y domingo quedan sin turno a propósito — el motor los clasifica como franco ('S').");
  console.log("Si algún convenio trabaja sábados o tiene un horario reducido ese día, avisame y lo agrego.");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
