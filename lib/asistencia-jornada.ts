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
// Por encima de las dos: el cambio de un día para la persona, y el feriado
// de la empresa. En un feriado sin fichadas el día queda 'F'; si igual fue a
// trabajar, se evalúa contra el horario que le tocaba.
import { clasificarDia, resolverTurno } from "./motor/motor-asistencia.mjs";
import { jornadaDelDia, jornadaEfectiva, fichadasDeLaJornada, turnoParaElMotor, horaDeReloj, type Asignacion, type Horario, type Excepciones } from "./turnos-reglas";

const DIA_MS = 24 * 3600 * 1000;

export interface DatosDelLegajo {
  id: string;
  convenioId: string;
  fichadaObligatoria: boolean;
  asignaciones: Asignacion[];
  excepciones?: Excepciones; // feriados de la empresa + cambios de un día de esta persona
}

export function clasificarJornada(
  fecha: Date,
  legajo: DatosDelLegajo,
  horarios: Map<string, Horario>,
  turnosDeRespaldo: any[],
  fichadasDe: (fecha: Date) => string[] // horas "HH:mm:ss" de ese legajo en esa fecha
) {
  const delDia = jornadaDelDia(fecha, legajo.asignaciones, horarios, legajo.excepciones);
  const hoy = jornadaEfectiva(delDia);
  const ayer = jornadaEfectiva(jornadaDelDia(new Date(fecha.getTime() - DIA_MS), legajo.asignaciones, horarios, legajo.excepciones));
  const horas = fichadasDeLaJornada(hoy, ayer, fichadasDe(fecha), fichadasDe(new Date(fecha.getTime() + DIA_MS)));
  const fichadas = horas.map((hora) => ({ hora }));
  const opciones = { diaSemana: fecha.getUTCDay(), fichadaObligatoria: legajo.fichadaObligatoria };

  if (delDia.tipo === "feriado" && horas.length === 0) {
    return { estado: "F", horaIngresoReal: null, horaEgresoReal: null, minutosTarde: null, minutosSalidaAnticipada: null };
  }

  let resultado;
  if (hoy.tipo === "sin_asignar") {
    resultado = clasificarDia(fichadas, resolverTurno(fecha, legajo.id, legajo.convenioId, turnosDeRespaldo), opciones);
  } else if (hoy.tipo === "trabaja") {
    resultado = clasificarDia(fichadas, turnoParaElMotor(hoy), opciones);
  } else {
    // Franco, por horario o por un cambio de ese día, caiga el día que
    // caiga (en una rotación puede ser un martes). El motor trata así a un
    // domingo sin turno: sin fichadas es FRANCO; con fichadas, día
    // trabajado fuera de programa.
    resultado = clasificarDia(fichadas, null, { ...opciones, diaSemana: 0 });
  }
  return { ...resultado, horaIngresoReal: horaDeReloj(resultado.horaIngresoReal), horaEgresoReal: horaDeReloj(resultado.horaEgresoReal) };
}
