// FM RRHH — lib/asistencia-jornada.ts
// Clasifica UN día de UN legajo (presente, tarde, ausente…) usando su
// horario asignado. Es el único lugar donde se decide eso: lo usan el botón
// "Clasificar" de /asistencia y el script prisma/clasificar-asistencia.ts,
// para que no vuelvan a existir dos copias de la misma lógica.
//
// Orden de prioridad del horario:
//   1. el HorarioTrabajo asignado a la persona (pantalla Turnos);
//   2. si no tiene ninguno, el Turno de respaldo (por legajo o convenio)
//      cargado por script — así nada cambia para quien todavía no usa la
//      pantalla nueva.
import { clasificarDia, resolverTurno } from "./motor/motor-asistencia.mjs";
import { jornadaDelDia, fichadasDeLaJornada, turnoParaElMotor, horaDeReloj, type Asignacion, type Horario } from "./turnos-reglas";

const DIA_MS = 24 * 3600 * 1000;

export interface DatosDelLegajo {
  id: string;
  convenioId: string;
  fichadaObligatoria: boolean;
  asignaciones: Asignacion[];
}

export function clasificarJornada(
  fecha: Date,
  legajo: DatosDelLegajo,
  horarios: Map<string, Horario>,
  turnosDeRespaldo: any[],
  fichadasDe: (fecha: Date) => string[] // horas "HH:mm:ss" de ese legajo en esa fecha
) {
  const hoy = jornadaDelDia(fecha, legajo.asignaciones, horarios);
  const ayer = jornadaDelDia(new Date(fecha.getTime() - DIA_MS), legajo.asignaciones, horarios);
  const horas = fichadasDeLaJornada(hoy, ayer, fichadasDe(fecha), fichadasDe(new Date(fecha.getTime() + DIA_MS)));
  const fichadas = horas.map((hora) => ({ hora }));
  const opciones = { diaSemana: fecha.getUTCDay(), fichadaObligatoria: legajo.fichadaObligatoria };

  let resultado;
  if (hoy.tipo === "sin_asignar") {
    resultado = clasificarDia(fichadas, resolverTurno(fecha, legajo.id, legajo.convenioId, turnosDeRespaldo), opciones);
  } else if (hoy.tipo === "franco") {
    // Franco por horario, caiga el día que caiga (en una rotación puede ser
    // un martes). El motor trata así a un domingo sin turno: sin fichadas es
    // FRANCO; con fichadas, día trabajado fuera de programa.
    resultado = clasificarDia(fichadas, null, { ...opciones, diaSemana: 0 });
  } else {
    resultado = clasificarDia(fichadas, turnoParaElMotor(hoy), opciones);
  }
  return { ...resultado, horaIngresoReal: horaDeReloj(resultado.horaIngresoReal), horaEgresoReal: horaDeReloj(resultado.horaEgresoReal) };
}
