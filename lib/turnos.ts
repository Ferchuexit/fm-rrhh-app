// FM RRHH — lib/turnos.ts
// Lado base de datos de los horarios de trabajo.
import { prisma } from "./prisma";
import { jornadaDelDia, claveDia, type Horario, type Jornada, type CambioDia, type Excepciones } from "./turnos-reglas";
export * from "./turnos-reglas";

const DIA_MS = 24 * 3600 * 1000;

export async function horariosDeEmpresa(empresaId: string): Promise<Map<string, Horario>> {
  const filas = await prisma.horarioTrabajo.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } });
  return new Map(filas.map((h) => [h.id, { id: h.id, nombre: h.nombre, color: h.color, dias: h.dias as unknown as Horario["dias"], ciclo: (h.ciclo as unknown as Horario["ciclo"]) ?? null }]));
}

// Lo que se muestra de una jornada (panel y portal).
export function vistaDeJornada(j: Jornada): { tipo: string; horario?: string; color?: string; ingreso?: string; salida?: string; nocturno?: boolean; cambio?: boolean; feriado?: string; grupo?: string } {
  if (j.tipo === "sin_asignar") return { tipo: j.tipo };
  if (j.tipo === "feriado") return { tipo: j.tipo, feriado: j.nombre };
  if (j.tipo === "franco") return { tipo: j.tipo, horario: j.horario?.nombre, cambio: j.cambio };
  // En un esquema por ciclo la misma persona pasa por mañana, tarde y
  // noche: el color sale de la hora de entrada (y no del horario, que es
  // uno solo), y los totales por día se agrupan por turno.
  const porCiclo = !!j.horario?.ciclo?.length && !j.cambio;
  const hora = Number(j.ingreso.slice(0, 2));
  const colorDeTurno = hora < 4 || hora >= 18 ? "#6E6AA8" : hora < 12 ? "#7FA8C6" : "#E8B36B";
  return { tipo: j.tipo, horario: j.horario?.nombre ?? "Cambio de turno", color: j.cambio ? "#F2D98D" : porCiclo ? colorDeTurno : j.horario?.color, ingreso: j.ingreso, salida: j.salida, nocturno: j.nocturno, cambio: j.cambio, ...(porCiclo ? { grupo: `${j.ingreso}–${j.salida}` } : {}) };
}

// Feriados de la empresa y cambios de un día, en un rango de fechas, listos
// para pasarle a jornadaDelDia(). `de(legajoId)` arma las de una persona.
export async function excepcionesEntre(empresaId: string, desde: Date, hasta: Date, legajoIds?: string[]) {
  const [feriados, cambios] = await Promise.all([
    prisma.feriado.findMany({ where: { empresaId, fecha: { gte: desde, lte: hasta } } }),
    prisma.cambioDeTurno.findMany({ where: { fecha: { gte: desde, lte: hasta }, legajo: { empresaId }, ...(legajoIds ? { legajoId: { in: legajoIds } } : {}) } }),
  ]);
  const mapaFeriados = new Map(feriados.map((f) => [claveDia(f.fecha), f.nombre]));
  const porLegajo = new Map<string, Map<string, CambioDia>>();
  for (const c of cambios) {
    if (!porLegajo.has(c.legajoId)) porLegajo.set(c.legajoId, new Map());
    porLegajo.get(c.legajoId)!.set(claveDia(c.fecha), c);
  }
  return { feriados, cambios, de: (legajoId: string): Excepciones => ({ feriados: mapaFeriados, cambios: porLegajo.get(legajoId) ?? new Map() }) };
}

// Las jornadas de UNA persona desde una fecha, tantos días como se pidan.
export async function jornadasDeLegajo(legajoId: string, empresaId: string, desde: Date, dias: number) {
  const hasta = new Date(desde.getTime() + (dias - 1) * DIA_MS);
  const [horarios, asignaciones, exc] = await Promise.all([
    horariosDeEmpresa(empresaId),
    prisma.asignacionHorario.findMany({ where: { legajoId }, select: { desde: true, hasta: true, horarioIds: true, diaDeCiclo: true } }),
    excepcionesEntre(empresaId, desde, hasta, [legajoId]),
  ]);
  return Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(desde.getTime() + i * DIA_MS);
    return { fecha, ...vistaDeJornada(jornadaDelDia(fecha, asignaciones, horarios, exc.de(legajoId))) };
  });
}
