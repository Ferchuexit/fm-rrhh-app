// FM RRHH — lib/indicadores-reglas.ts
// Los cálculos del tablero de indicadores de Gestión Humana. Funciones
// puras (tests/indicadores-reglas.test.mjs): reciben datos ya leídos y
// devuelven números. Las fechas son días (medianoche UTC).
//
// Criterio general: un indicador sin datos devuelve null, no cero. "0 % de
// ausentismo" y "no se cargó la asistencia" son cosas muy distintas, y el
// tablero las muestra distinto.

const DIA = 86400000;
const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m, d));

// Porcentaje con un decimal; null si no hay sobre qué calcular.
export const pct = (parte: number, total: number): number | null => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);
const promedio = (v: number[]): number | null => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);
export { promedio };

// ── Períodos ─────────────────────────────────────────────────────────
export interface Mes { clave: string; rotulo: string; desde: Date; hasta: Date }
const NOMBRES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// Los últimos `n` meses, del más viejo al actual (que va hasta `hoy`).
export function ultimosMeses(hoy: Date, n: number): Mes[] {
  const meses: Mes[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const desde = utc(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1);
    const fin = utc(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 0);
    meses.push({ clave: desde.toISOString().slice(0, 7), rotulo: `${NOMBRES[desde.getUTCMonth()]} ${String(desde.getUTCFullYear()).slice(2)}`, desde, hasta: fin > hoy ? hoy : fin });
  }
  return meses;
}

// ── Dotación y rotación ──────────────────────────────────────────────
export interface PersonaDotacion { id: string; fechaIngreso: Date; fechaEgreso: Date | null; activo: boolean; motivo: string | null }
// Quien figura de baja sin fecha de egreso no se puede ubicar en el tiempo:
// no cuenta como dotación en ninguna fecha (y se informa aparte).
const estaba = (p: PersonaDotacion, fecha: Date) => p.fechaIngreso <= fecha && (p.fechaEgreso ? p.fechaEgreso > fecha : p.activo);
export const dotacionAl = (personas: PersonaDotacion[], fecha: Date) => personas.filter((p) => estaba(p, fecha)).length;
const entre = (f: Date | null, desde: Date, hasta: Date) => !!f && f >= desde && f <= hasta;

export function movimientoPorMes(personas: PersonaDotacion[], meses: Mes[]) {
  return meses.map((m) => ({ mes: m.rotulo, altas: personas.filter((p) => entre(p.fechaIngreso, m.desde, m.hasta)).length, bajas: personas.filter((p) => entre(p.fechaEgreso, m.desde, m.hasta)).length, dotacion: dotacionAl(personas, m.hasta) }));
}

export const MOTIVOS_VOLUNTARIOS = ["renuncia", "mutuo_acuerdo"];
export const DIAS_BAJA_TEMPRANA = 90;
// Rotación del período: bajas sobre la dotación promedio (la del comienzo y
// la del final). `anualizada` la lleva a 12 meses para poder comparar un
// trimestre con un año.
export function rotacion(personas: PersonaDotacion[], desde: Date, hasta: Date) {
  const bajas = personas.filter((p) => entre(p.fechaEgreso, desde, hasta));
  const dotacionMedia = (dotacionAl(personas, new Date(desde.getTime() - DIA)) + dotacionAl(personas, hasta)) / 2;
  const dias = Math.round((hasta.getTime() - desde.getTime()) / DIA) + 1;
  const tasa = pct(bajas.length, dotacionMedia);
  const voluntarias = bajas.filter((b) => b.motivo && MOTIVOS_VOLUNTARIOS.includes(b.motivo)).length;
  const porMotivo = Object.entries(bajas.reduce<Record<string, number>>((a, b) => ({ ...a, [b.motivo ?? "sin_motivo"]: (a[b.motivo ?? "sin_motivo"] ?? 0) + 1 }), {})).map(([clave, cantidad]) => ({ clave, cantidad })).sort((x, y) => y.cantidad - x.cantidad);
  return {
    bajas: bajas.length, altas: personas.filter((p) => entre(p.fechaIngreso, desde, hasta)).length, dotacionMedia: Math.round(dotacionMedia * 10) / 10, tasa,
    anualizada: tasa === null ? null : Math.round(tasa * (365 / dias) * 10) / 10,
    voluntarias, tasaVoluntaria: pct(voluntarias, dotacionMedia),
    // Se fueron antes de los 90 días: suele hablar de la selección o del ingreso, no del puesto.
    tempranas: bajas.filter((b) => b.fechaEgreso!.getTime() - b.fechaIngreso.getTime() < DIAS_BAJA_TEMPRANA * DIA).length,
    porMotivo,
  };
}

export function antiguedadPromedio(personas: PersonaDotacion[], hoy: Date): number | null {
  return promedio(personas.filter((p) => estaba(p, hoy)).map((p) => (hoy.getTime() - p.fechaIngreso.getTime()) / (365.25 * DIA)));
}

// ── Ausentismo (desde los códigos de la asistencia) ──────────────────
export type TipoAusencia = "injustificada" | "aviso" | "enfermedad" | "art" | "suspension";
export const TIPOS_AUSENCIA: Record<TipoAusencia, { nombre: string; codigos: string[] }> = {
  injustificada: { nombre: "Sin aviso", codigos: ["A"] },
  aviso: { nombre: "Con aviso", codigos: ["AA", "AAS"] },
  enfermedad: { nombre: "Enfermedad", codigos: ["E", "ES"] },
  art: { nombre: "Accidente (ART)", codigos: ["AC", "ACS"] },
  suspension: { nombre: "Suspensión", codigos: ["SUS"] },
};
export const CLAVES_AUSENCIA = Object.keys(TIPOS_AUSENCIA) as TipoAusencia[];
const PRESENTES = ["P", "T", "SA"];
export const tipoDe = (estado: string): TipoAusencia | null => CLAVES_AUSENCIA.find((t) => TIPOS_AUSENCIA[t].codigos.includes(estado)) ?? null;
// Días que cuentan como "había que trabajar": presentes + ausencias. Francos,
// feriados, vacaciones y licencias pagas no entran ni arriba ni abajo.
const esLaborable = (estado: string) => PRESENTES.includes(estado) || tipoDe(estado) !== null;

export interface DiaAsistencia { legajoId: string; fecha: Date; estado: string }
export function ausentismo(dias: DiaAsistencia[]) {
  const laborables = dias.filter((d) => esLaborable(d.estado));
  const porTipo = Object.fromEntries(CLAVES_AUSENCIA.map((t) => [t, dias.filter((d) => tipoDe(d.estado) === t).length])) as Record<TipoAusencia, number>;
  const ausencias = CLAVES_AUSENCIA.reduce((a, t) => a + porTipo[t], 0);
  return { laborables: laborables.length, ausencias, tasa: pct(ausencias, laborables.length), porTipo, tardanzas: dias.filter((d) => d.estado === "T").length, puntualidad: pct(laborables.filter((d) => d.estado === "P" || d.estado === "SA").length, laborables.filter((d) => PRESENTES.includes(d.estado)).length) };
}
export const ausentismoPorMes = (dias: DiaAsistencia[], meses: Mes[]) => meses.map((m) => ({ mes: m.rotulo, ...ausentismo(dias.filter((d) => d.fecha >= m.desde && d.fecha <= m.hasta)) }));

// Licencias prolongadas: quien lleva `minimo` días corridos o más de
// enfermedad o de ART, y sigue (su último registro de ese tipo es reciente).
// Los francos y feriados del medio no cortan la licencia; un día trabajado, sí.
export function licenciasProlongadas(dias: DiaAsistencia[], hoy: Date, minimo = 10, reciente = 7) {
  const porPersona = new Map<string, DiaAsistencia[]>();
  for (const d of dias) porPersona.set(d.legajoId, [...(porPersona.get(d.legajoId) ?? []), d]);
  const lista: { legajoId: string; tipo: "enfermedad" | "art"; desde: Date; hasta: Date; dias: number }[] = [];
  for (const [legajoId, suyos] of porPersona) {
    const orden = suyos.filter((d) => esLaborable(d.estado)).sort((a, b) => b.fecha.getTime() - a.fecha.getTime()); // del más nuevo al más viejo
    const tipo = orden.length ? tipoDe(orden[0].estado) : null;
    if (tipo !== "enfermedad" && tipo !== "art") continue;
    let desde = orden[0].fecha;
    for (const d of orden) { if (tipoDe(d.estado) !== tipo) break; desde = d.fecha; }
    const corridos = Math.round((orden[0].fecha.getTime() - desde.getTime()) / DIA) + 1;
    if (corridos >= minimo && hoy.getTime() - orden[0].fecha.getTime() <= reciente * DIA) lista.push({ legajoId, tipo, desde, hasta: orden[0].fecha, dias: corridos });
  }
  return lista.sort((a, b) => b.dias - a.dias);
}

// ── Vacaciones: cuánta gente va a estar afuera ───────────────────────
export function vacacionesAFuturo(vacaciones: { legajoId: string; fechaDesde: Date; fechaHasta: Date }[], hoy: Date, dias = 30) {
  const hasta = new Date(hoy.getTime() + dias * DIA);
  const afuera = (f: Date) => new Set(vacaciones.filter((v) => v.fechaDesde <= f && v.fechaHasta >= f).map((v) => v.legajoId)).size;
  let pico = { fecha: hoy, personas: afuera(hoy) };
  for (let f = hoy; f <= hasta; f = new Date(f.getTime() + DIA)) { const n = afuera(f); if (n > pico.personas) pico = { fecha: f, personas: n }; }
  return { hoy: afuera(hoy), enElPlazo: new Set(vacaciones.filter((v) => v.fechaDesde <= hasta && v.fechaHasta >= hoy).map((v) => v.legajoId)).size, pico };
}

// ── Tareas con vencimiento (onboarding y offboarding) ────────────────
export function cumplimientoTareas(tareas: { vence: Date; hechaEn: Date | null; aplica: boolean }[], hoy: Date) {
  const validas = tareas.filter((t) => t.aplica);
  const hechas = validas.filter((t) => t.hechaEn);
  // "A tiempo": se hizo el día del vencimiento o antes (se compara por día).
  const aTiempo = hechas.filter((t) => t.hechaEn!.getTime() < t.vence.getTime() + DIA).length;
  return { total: validas.length, hechas: hechas.length, vencidas: validas.filter((t) => !t.hechaEn && t.vence < hoy).length, avance: pct(hechas.length, validas.length), aTiempo: pct(aTiempo, hechas.length) };
}

// ── Semáforo ─────────────────────────────────────────────────────────
export type Estado = "bien" | "atencion" | "critico" | "sin_dato";
// `bien` y `atencion` son los límites; `mayorEsMejor` dice para qué lado.
//   ausentismo:    semaforo(v, 3, 6, false) → hasta 3 bien, hasta 6 atención, más crítico
//   documentación: semaforo(v, 90, 70, true) → desde 90 bien, desde 70 atención, menos crítico
export function semaforo(valor: number | null, bien: number, atencion: number, mayorEsMejor: boolean): Estado {
  if (valor === null) return "sin_dato";
  if (mayorEsMejor) return valor >= bien ? "bien" : valor >= atencion ? "atencion" : "critico";
  return valor <= bien ? "bien" : valor <= atencion ? "atencion" : "critico";
}

// Las referencias que usa el tablero. Son orientativas (cada industria
// tiene las suyas) y están en un solo lugar para poder ajustarlas.
export const REFERENCIAS = {
  rotacionAnual: { bien: 15, atencion: 25, mayorEsMejor: false, texto: "hasta 15 % anual" },
  ausentismo: { bien: 3, atencion: 6, mayorEsMejor: false, texto: "hasta 3 %" },
  clima: { bien: 70, atencion: 55, mayorEsMejor: true, texto: "70 % favorable o más" },
  documentacion: { bien: 90, atencion: 70, mayorEsMejor: true, texto: "90 % de legajos completos" },
  asistenciaCapacitacion: { bien: 90, atencion: 75, mayorEsMejor: true, texto: "90 % o más" },
  tareasATiempo: { bien: 85, atencion: 65, mayorEsMejor: true, texto: "85 % o más" },
} as const;
export const estadoDe = (clave: keyof typeof REFERENCIAS, valor: number | null) => semaforo(valor, REFERENCIAS[clave].bien, REFERENCIAS[clave].atencion, REFERENCIAS[clave].mayorEsMejor);

// ── "Para mirar": lo que el tablero señala solo ──────────────────────
export interface Alerta { nivel: "critico" | "atencion"; texto: string; url: string }
export interface DatosAlertas {
  rotacionAnual: number | null; bajasTempranas: number; ausentismo: number | null; sinAviso: number; prolongadas: number;
  clima: number | null; documentacion: number | null; docPendientesRrhh: number;
  constanciasSinFirmar: number; habilidadesVencidas: number; habilidadesPorVencer: number;
  tareasIngresoVencidas: number; tareasEgresoVencidas: number; egresosSinEntrevista: number;
  vacantes: number; busquedasViejas: number; candidatosSinRevisar: number; evaluacionesPendientes: number; objetivosVencidos: number; picoVacaciones: number; dotacion: number;
}
const n = (cant: number, uno: string, varios: string) => `${cant} ${cant === 1 ? uno : varios}`;
export function alertas(d: DatosAlertas): Alerta[] {
  const lista: Alerta[] = [];
  const sumar = (si: boolean, nivel: Alerta["nivel"], texto: string, url: string) => { if (si) lista.push({ nivel, texto, url }); };
  const e = (clave: keyof typeof REFERENCIAS, v: number | null) => estadoDe(clave, v);
  sumar(e("rotacionAnual", d.rotacionAnual) === "critico", "critico", `La rotación anualizada es del ${d.rotacionAnual} %: está muy por encima de lo esperable (${REFERENCIAS.rotacionAnual.texto}).`, "/offboarding");
  sumar(e("rotacionAnual", d.rotacionAnual) === "atencion", "atencion", `La rotación anualizada es del ${d.rotacionAnual} % (referencia: ${REFERENCIAS.rotacionAnual.texto}).`, "/offboarding");
  sumar(d.bajasTempranas > 0, "atencion", `${n(d.bajasTempranas, "persona se fue", "personas se fueron")} antes de los 90 días de ingresar: conviene revisar la selección y el ingreso.`, "/offboarding");
  sumar(e("ausentismo", d.ausentismo) === "critico", "critico", `El ausentismo es del ${d.ausentismo} % (referencia: ${REFERENCIAS.ausentismo.texto}).`, "/kpis");
  sumar(e("ausentismo", d.ausentismo) === "atencion", "atencion", `El ausentismo es del ${d.ausentismo} % (referencia: ${REFERENCIAS.ausentismo.texto}).`, "/kpis");
  sumar(d.prolongadas > 0, "atencion", `${n(d.prolongadas, "persona lleva", "personas llevan")} 10 días corridos o más de licencia por enfermedad o ART.`, "/asistencia");
  sumar(e("clima", d.clima) === "critico", "critico", `En la última encuesta, solo el ${d.clima} % de las respuestas fue favorable.`, "/encuestas");
  sumar(e("clima", d.clima) === "atencion", "atencion", `En la última encuesta, el ${d.clima} % de las respuestas fue favorable (referencia: ${REFERENCIAS.clima.texto}).`, "/encuestas");
  sumar(e("documentacion", d.documentacion) === "critico", "critico", `Solo el ${d.documentacion} % de los legajos tiene la documentación completa.`, "/legajo-digital");
  sumar(e("documentacion", d.documentacion) === "atencion", "atencion", `El ${d.documentacion} % de los legajos tiene la documentación completa (referencia: ${REFERENCIAS.documentacion.texto}).`, "/legajo-digital");
  sumar(d.docPendientesRrhh > 0, "atencion", `Hay ${n(d.docPendientesRrhh, "documento esperando", "documentos esperando")} revisión de RR.HH.`, "/legajo-digital");
  sumar(d.habilidadesVencidas > 0, "critico", `${n(d.habilidadesVencidas, "habilitación vencida", "habilitaciones vencidas")}: gente que no debería estar haciendo esa tarea.`, "/habilidades");
  sumar(d.habilidadesPorVencer > 0, "atencion", `${n(d.habilidadesPorVencer, "habilitación vence", "habilitaciones vencen")} en los próximos 60 días.`, "/habilidades");
  sumar(d.constanciasSinFirmar > 0, "atencion", `${n(d.constanciasSinFirmar, "constancia de capacitación sin firmar", "constancias de capacitación sin firmar")} por el empleado.`, "/capacitaciones");
  sumar(d.tareasIngresoVencidas > 0, "atencion", `${n(d.tareasIngresoVencidas, "tarea de ingreso vencida", "tareas de ingreso vencidas")}.`, "/onboarding");
  sumar(d.tareasEgresoVencidas > 0, "atencion", `${n(d.tareasEgresoVencidas, "tarea de egreso vencida", "tareas de egreso vencidas")}.`, "/offboarding");
  sumar(d.egresosSinEntrevista > 0, "atencion", `${n(d.egresosSinEntrevista, "egreso sin", "egresos sin")} entrevista de salida: se pierde el motivo real.`, "/offboarding");
  sumar(d.busquedasViejas > 0, "atencion", `${n(d.busquedasViejas, "búsqueda lleva", "búsquedas llevan")} más de 30 días abierta.`, "/reclutamiento");
  sumar(d.candidatosSinRevisar > 0, "atencion", `${n(d.candidatosSinRevisar, "candidato sin revisar", "candidatos sin revisar")}.`, "/reclutamiento");
  sumar(d.evaluacionesPendientes > 0, "atencion", `${n(d.evaluacionesPendientes, "evaluación de desempeño sin completar", "evaluaciones de desempeño sin completar")}.`, "/evaluaciones");
  sumar(d.objetivosVencidos > 0, "atencion", `${n(d.objetivosVencidos, "objetivo vencido", "objetivos vencidos")} sin cerrar.`, "/objetivos");
  // Un cuarto de la dotación afuera el mismo día ya complica la operación.
  sumar(d.dotacion >= 4 && d.picoVacaciones / d.dotacion >= 0.25, "atencion", `En los próximos 30 días hay un día con ${d.picoVacaciones} personas de vacaciones a la vez (${Math.round((d.picoVacaciones / d.dotacion) * 100)} % de la dotación).`, "/agenda");
  return lista.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "critico" ? -1 : 1));
}
