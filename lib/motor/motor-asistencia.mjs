// FM RRHH — motor-asistencia.mjs
//
// Clasifica UN día de UN legajo, a partir de sus fichadas (marcas de reloj)
// y el turno vigente ese día.
//
// Vocabulario de estados AUTOMÁTICOS (los únicos que el motor puede inferir
// solo, a partir de fichadas + turno):
//   'P'          presente, día de semana, sin novedad de horario
//   'T'          llegada tarde (fichada de ingreso posterior al turno)
//   'SA'         salida anticipada (fichada de egreso anterior al turno)
//   'A'          ausente, día de semana, sin ninguna fichada
//   'S'          trabajó un sábado (o domingo) que normalmente sería franco
//   'FRANCO'     día sin turno y sin fichadas — no se muestra letra en
//                pantalla, es simplemente el día libre de esa persona
//   'IMPAR'      cantidad de fichadas impar ese día — no se puede inferir
//                presente/ausente con certeza, hay que revisarlo a mano
//   'SIN_TURNO'  día de semana con o sin fichadas, pero SIN turno cargado
//                para ese legajo — dato faltante, no franco ni ausencia
//   'SIN_CONTROL' personal de obra (fichadaObligatoria=false) sin fichada
//                ese día — no es ausencia, es la normalidad para ellos
//
// Vocabulario MANUAL (el motor nunca los pone solo — se cargan a mano
// pisando la fila, igual que hacía tu Excel con VC/E/ES sobre la fórmula.
// Ver OPCIONES_MANUAL en app/asistencia/page.tsx):
//   'F'    feriado                       'AC'   día por ART
//   'E'    licencia por enfermedad       'ACS'  ART, sábado
//   'ES'   enfermedad, sábado            'SUS'  suspensión
//   'AA'   ausente con aviso             'LP'   licencia paga
//   'AAS'  ausente con aviso, sábado     'VC'   vacaciones
//                                        'VCS'  vacaciones, sábado
// VC/VCS son la única excepción real: se auto-completan desde el modelo
// Vacacion ya existente (ver prisma/sincronizar-vacaciones-asistencia.ts),
// no hace falta cargarlas a mano dos veces — pero técnicamente TAMBIÉN son
// "manuales" para este motor: se escriben con origen='manual' para que
// clasificar-asistencia.ts nunca las pise.
//
// 'T' y 'SA' quedan en pie tal cual estaban — la lista de códigos nueva no
// los menciona, pero tampoco pide sacarlos, y ya están probados. Si hace
// falta, se revisa después de ver cómo se ve en pantalla.
//
// Personal de OBRA: arrancan directo en el sitio de trabajo y fichan solo
// eventualmente — para ellos, "sin fichada" NO es ausencia (ver parámetro
// fichadaObligatoria más abajo).

/**
 * @param {{hora: string}[]} fichadasDelDia - ordenadas cronológicamente, "HH:mm:ss"
 * @param {{horaIngreso: string, horaSalida: string} | null} turno - turno vigente ese día, o null si no hay
 * @param {{diaSemana: number, fichadaObligatoria?: boolean}} contexto
 *   - diaSemana: 0=domingo..6=sábado (SIEMPRE con getUTCDay(), nunca getDay() — ver resolverTurno).
 *   - fichadaObligatoria: false para personal de obra. Default true (personal de planta).
 * @returns {{
 *   estado: 'P'|'T'|'SA'|'A'|'S'|'FRANCO'|'IMPAR'|'SIN_TURNO'|'SIN_CONTROL',
 *   horaIngresoReal: string|null,
 *   horaEgresoReal: string|null,
 *   minutosTarde: number|null,
 *   minutosSalidaAnticipada: number|null,
 * }}
 */
function clasificarDia(fichadasDelDia, turno, { diaSemana, fichadaObligatoria = true } = {}) {
  const base = { horaIngresoReal: null, horaEgresoReal: null, minutosTarde: null, minutosSalidaAnticipada: null };
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
  const esSabado = diaSemana === 6;

  const ordenadas = [...fichadasDelDia].sort((a, b) => a.hora.localeCompare(b.hora));

  if (!turno) {
    // Sin turno cargado.
    if (esFinDeSemana) {
      // Fin de semana sin turno explícito: si nadie fichó, es franco
      // normal (no se muestra letra). Si SÍ hay fichadas (alguien vino un
      // sábado sin que estuviera formalmente programado), se marca 'S' —
      // no hay horario de referencia, así que no se puede calcular
      // tardanza/salida anticipada ese día.
      if (ordenadas.length === 0) return { estado: "FRANCO", ...base };
      return {
        estado: "S",
        horaIngresoReal: ordenadas[0].hora,
        horaEgresoReal: ordenadas.length > 1 ? ordenadas[ordenadas.length - 1].hora : null,
        minutosTarde: null,
        minutosSalidaAnticipada: null,
      };
    }
    // Día de semana sin turno cargado: dato faltante, siempre — haya o no
    // haya fichadas, no se puede clasificar bien sin saber el horario.
    return { estado: "SIN_TURNO", ...base };
  }

  if (ordenadas.length === 0) {
    if (esFinDeSemana) {
      // Tiene turno de fin de semana cargado (trabaja ese día) pero no
      // fichó — esto es una ausencia en sábado, pero la carga es MANUAL
      // (AS/AAS, según si avisó) porque el motor no puede distinguir una
      // de otra. Se deja como FRANCO por ahora, no se inventa un AS solo.
      return { estado: "FRANCO", ...base };
    }
    return { estado: fichadaObligatoria ? "A" : "SIN_CONTROL", ...base };
  }

  if (ordenadas.length % 2 !== 0) {
    return {
      estado: "IMPAR",
      horaIngresoReal: ordenadas[0].hora,
      horaEgresoReal: ordenadas.length > 1 ? ordenadas[ordenadas.length - 1].hora : null,
      minutosTarde: null,
      minutosSalidaAnticipada: null,
    };
  }

  const horaIngresoReal = ordenadas[0].hora;
  const horaEgresoReal = ordenadas[ordenadas.length - 1].hora;

  const minutosTarde = Math.max(0, aMinutos(horaIngresoReal) - aMinutos(turno.horaIngreso));
  const minutosSalidaAnticipada = Math.max(0, aMinutos(turno.horaSalida) - aMinutos(horaEgresoReal));

  let estado = "P";
  if (minutosTarde > 0) estado = "T";
  else if (minutosSalidaAnticipada > 0) estado = "SA";

  // Sábado trabajado con horario cumplido sin problemas → 'S' en vez de
  // 'P', para distinguirlo visualmente de un día de semana normal. Si hubo
  // tardanza o salida anticipada, esos códigos priman igual (son sobre
  // puntualidad, no sobre qué día de la semana es).
  if (esSabado && estado === "P") estado = "S";

  return { estado, horaIngresoReal, horaEgresoReal, minutosTarde, minutosSalidaAnticipada };
}

function aMinutos(horaHHmm) {
  const [h, m] = horaHHmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Resuelve qué Turno aplica para un legajo en una fecha dada, entre una
 * lista de turnos ya cargados (todos los del legajo + todos los del
 * convenio, para no pegarle una consulta a la base por cada día).
 * Prioridad: turno específico del legajo > turno del convenio.
 *
 * @param {Date} fecha
 * @param {string} legajoId
 * @param {string} convenioId
 * @param {Array} turnos - [{ legajoId, convenioId, diaSemana, horaIngreso, horaSalida, vigenciaDesde, vigenciaHasta }]
 */
function resolverTurno(fecha, legajoId, convenioId, turnos) {
  const diaSemana = fecha.getUTCDay(); // UTC, no local — ver nota de la vuelta que encontró este bug: getDay() usa el huso horario de la máquina, y como las fechas se guardan como medianoche UTC, en Argentina (UTC-3) corría el día de la semana un día para atrás (un lunes a medianoche UTC todavía es domingo a la noche en hora local).
  const candidatos = turnos.filter(
    (t) =>
      t.diaSemana === diaSemana &&
      t.vigenciaDesde <= fecha &&
      (!t.vigenciaHasta || t.vigenciaHasta >= fecha)
  );

  const delLegajo = candidatos.find((t) => t.legajoId === legajoId);
  if (delLegajo) return delLegajo;

  const delConvenio = candidatos.find((t) => t.legajoId === null && t.convenioId === convenioId);
  return delConvenio ?? null;
}

export { clasificarDia, resolverTurno, aMinutos };
