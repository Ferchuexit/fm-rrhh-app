// FM RRHH — prisma/sincronizar-vacaciones-asistencia.ts
//
// Marca VC (o VCS si cae sábado) en AsistenciaDia para cada día dentro de
// un período de Vacacion YA REGISTRADO en el sistema (el mismo modelo que
// usa /vacaciones y su diagrama de Gantt) — así no hace falta cargar la
// vacación dos veces, una en /vacaciones y otra a mano en /asistencia.
//
// Se escribe con origen='manual' (aunque lo puso el sistema, no vos a
// mano) — es a propósito: clasificar-asistencia.ts SIEMPRE salta las filas
// con origen='manual', así que una vez sincronizada una vacación acá, el
// motor automático nunca la va a pisar por error si volvés a clasificar
// ese rango de fechas.
//
// No borra nada: si ya había algo cargado a mano distinto para ese día
// (una corrección tuya puntual), se pisa igual — la fuente de verdad para
// vacaciones es la tabla Vacacion, no lo que haya en la grilla.
//
// Uso:
//   npx tsx prisma/sincronizar-vacaciones-asistencia.ts [desde YYYY-MM-DD] [hasta YYYY-MM-DD]
//
// Sin argumentos: sincroniza TODAS las vacaciones cargadas, sin límite de
// fecha. Con argumentos: solo las que caen (parcial o totalmente) dentro
// del rango — útil para no recorrer años de historial cada vez.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function* rangoFechas(desde: Date, hasta: Date) {
  const actual = new Date(desde);
  while (actual <= hasta) {
    yield new Date(actual);
    actual.setUTCDate(actual.getUTCDate() + 1);
  }
}

async function main() {
  const [desdeStr, hastaStr] = process.argv.slice(2);
  const filtroFecha =
    desdeStr && hastaStr
      ? {
          OR: [
            { fechaDesde: { gte: new Date(desdeStr), lte: new Date(hastaStr) } },
            { fechaHasta: { gte: new Date(desdeStr), lte: new Date(hastaStr) } },
            { AND: [{ fechaDesde: { lte: new Date(desdeStr) } }, { fechaHasta: { gte: new Date(hastaStr) } }] },
          ],
        }
      : {};

  const vacaciones = await prisma.vacacion.findMany({
    where: filtroFecha,
    include: { legajo: { select: { id: true, numeroLegajo: true, apellido: true } } },
  });

  console.log(`Períodos de vacaciones encontrados: ${vacaciones.length}`);

  let diasMarcados = 0;

  for (const v of vacaciones) {
    let diasDeEsteVacacion = 0;
    for (const fecha of rangoFechas(v.fechaDesde, v.fechaHasta)) {
      const esSabado = fecha.getUTCDay() === 6;
      const estado = esSabado ? "VCS" : "VC";

      await prisma.asistenciaDia.upsert({
        where: { legajoId_fecha: { legajoId: v.legajoId, fecha } },
        create: { legajoId: v.legajoId, fecha, estado, origen: "manual", motivoManual: "Sincronizado desde Vacacion" },
        update: { estado, origen: "manual", motivoManual: "Sincronizado desde Vacacion" },
      });
      diasDeEsteVacacion++;
      diasMarcados++;
    }
    console.log(`  Legajo ${v.legajo.numeroLegajo} (${v.legajo.apellido}): ${diasDeEsteVacacion} día(s) marcados VC/VCS (${v.fechaDesde.toISOString().substring(0,10)} a ${v.fechaHasta.toISOString().substring(0,10)}).`);
  }

  console.log(`\nListo. Total de días marcados: ${diasMarcados}.`);
  console.log("Corré esto de nuevo cada vez que se registre una vacación nueva en /vacaciones.");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
