// FM RRHH — prisma/clasificar-asistencia.ts
//
// Corre el motor de clasificación (lib/motor/motor-asistencia.mjs) sobre un
// rango de fechas para todos los legajos activos, y persiste el resultado
// en AsistenciaDia. Se puede correr de nuevo sobre el mismo rango sin
// problema — hace upsert, no duplica.
//
// IMPORTANTE: si un día ya tiene un AsistenciaDia con origen='manual' (por
// ejemplo, alguien ya cargó "VACACIONES" a mano para ese legajo/fecha), NO
// se pisa — el motor automático nunca gana sobre una carga manual, mismo
// criterio que tu Excel (P/A automático, pero VC/E/ES pisaban la fórmula).
//
// Uso:
//   npx tsx prisma/clasificar-asistencia.ts <desde YYYY-MM-DD> <hasta YYYY-MM-DD>
//
// Ejemplo (una quincena):
//   npx tsx prisma/clasificar-asistencia.ts 2026-01-16 2026-01-31
import { PrismaClient } from "@prisma/client";
import { clasificarDia, resolverTurno } from "../lib/motor/motor-asistencia.mjs";

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
  if (!desdeStr || !hastaStr) {
    console.error("Uso: npx tsx prisma/clasificar-asistencia.ts <desde YYYY-MM-DD> <hasta YYYY-MM-DD>");
    process.exit(1);
  }
  const desde = new Date(desdeStr + "T00:00:00.000Z");
  const hasta = new Date(hastaStr + "T00:00:00.000Z");

  const legajos = await prisma.legajo.findMany({
    where: { condicion: "activo" },
    select: { id: true, numeroLegajo: true, apellido: true, convenioId: true, fichadaObligatoria: true },
  });
  console.log(`Legajos activos: ${legajos.length}`);

  const turnos = await prisma.turno.findMany();
  const fichadas = await prisma.fichada.findMany({
    where: { fecha: { gte: desde, lte: hasta } },
  });
  const periodosCerrados = await prisma.periodoAsistencia.findMany({ where: { estado: "cerrado" } });
  const fechaEstaCerrada = (fecha: Date) => periodosCerrados.find((p) => p.fechaDesde <= fecha && p.fechaHasta >= fecha) ?? null;

  // Agrupar fichadas por legajoId+fecha (ISO) para acceso O(1) por día.
  const fichadasPorLegajoFecha = new Map<string, { hora: string }[]>();
  for (const f of fichadas) {
    const clave = `${f.legajoId}|${f.fecha.toISOString()}`;
    if (!fichadasPorLegajoFecha.has(clave)) fichadasPorLegajoFecha.set(clave, []);
    fichadasPorLegajoFecha.get(clave)!.push({ hora: f.hora });
  }

  let procesados = 0, saltadosPorManual = 0, saltadosPorCierre = 0, contadorEstados: Record<string, number> = {};

  for (const legajo of legajos) {
    for (const fecha of rangoFechas(desde, hasta)) {
      if (fechaEstaCerrada(fecha)) { saltadosPorCierre++; continue; }

      const existente = await prisma.asistenciaDia.findUnique({
        where: { legajoId_fecha: { legajoId: legajo.id, fecha } },
      });
      if (existente?.origen === "manual") { saltadosPorManual++; continue; }

      const turno = resolverTurno(fecha, legajo.id, legajo.convenioId, turnos as any);
      const clave = `${legajo.id}|${fecha.toISOString()}`;
      const fichadasDelDia = fichadasPorLegajoFecha.get(clave) ?? [];
      const diaSemana = fecha.getUTCDay();

      const resultado = clasificarDia(fichadasDelDia, turno, { diaSemana, fichadaObligatoria: legajo.fichadaObligatoria });

      await prisma.asistenciaDia.upsert({
        where: { legajoId_fecha: { legajoId: legajo.id, fecha } },
        create: {
          legajoId: legajo.id,
          fecha,
          estado: resultado.estado,
          horaIngresoReal: resultado.horaIngresoReal,
          horaEgresoReal: resultado.horaEgresoReal,
          minutosTarde: resultado.minutosTarde,
          minutosSalidaAnticipada: resultado.minutosSalidaAnticipada,
          origen: "automatico",
        },
        update: {
          estado: resultado.estado,
          horaIngresoReal: resultado.horaIngresoReal,
          horaEgresoReal: resultado.horaEgresoReal,
          minutosTarde: resultado.minutosTarde,
          minutosSalidaAnticipada: resultado.minutosSalidaAnticipada,
        },
      });

      procesados++;
      contadorEstados[resultado.estado] = (contadorEstados[resultado.estado] ?? 0) + 1;
    }
  }

  console.log(`\nListo. Días procesados: ${procesados}. Saltados por tener carga manual: ${saltadosPorManual}. Saltados por período cerrado: ${saltadosPorCierre}.`);
  console.log("Resumen por estado:", contadorEstados);
  if (contadorEstados["SIN_TURNO"] > 0) {
    console.log(`\n⚠ ${contadorEstados["SIN_TURNO"]} día(s) quedaron como 'SIN_TURNO' — hay fichadas pero no turno cargado para ese legajo/día. Revisar antes de confiar en el ausentismo de esos legajos.`);
  }
  if (contadorEstados["SIN_CONTROL"] > 0) {
    console.log(`${contadorEstados["SIN_CONTROL"]} día(s) marcados 'SIN_CONTROL' — personal de obra (fichadaObligatoria=false) sin fichada ese día. No cuenta como ausencia.`);
  }
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
