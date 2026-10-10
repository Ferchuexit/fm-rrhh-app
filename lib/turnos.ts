// FM RRHH — lib/turnos.ts
// Lado base de datos de los horarios de trabajo.
import { prisma } from "./prisma";
import { jornadaDelDia, type Horario, type Jornada } from "./turnos-reglas";
export * from "./turnos-reglas";

const DIA_MS = 24 * 3600 * 1000;

export async function horariosDeEmpresa(empresaId: string): Promise<Map<string, Horario>> {
  const filas = await prisma.horarioTrabajo.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } });
  return new Map(filas.map((h) => [h.id, { id: h.id, nombre: h.nombre, color: h.color, dias: h.dias as unknown as Horario["dias"] }]));
}

// Lo que se muestra de una jornada (panel y portal).
export function vistaDeJornada(j: Jornada) {
  if (j.tipo === "sin_asignar") return { tipo: j.tipo };
  if (j.tipo === "franco") return { tipo: j.tipo, horario: j.horario.nombre };
  return { tipo: j.tipo, horario: j.horario.nombre, color: j.horario.color, ingreso: j.ingreso, salida: j.salida, nocturno: j.nocturno };
}

// Las jornadas de UNA persona desde una fecha, tantos días como se pidan.
export async function jornadasDeLegajo(legajoId: string, empresaId: string, desde: Date, dias: number) {
  const [horarios, asignaciones] = await Promise.all([
    horariosDeEmpresa(empresaId),
    prisma.asignacionHorario.findMany({ where: { legajoId }, select: { desde: true, hasta: true, horarioIds: true } }),
  ]);
  return Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(desde.getTime() + i * DIA_MS);
    return { fecha, ...vistaDeJornada(jornadaDelDia(fecha, asignaciones, horarios)) };
  });
}
