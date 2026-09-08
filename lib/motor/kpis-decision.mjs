// FM RRHH — kpis-decision.mjs
//
// Distinto de motor-auditoria.mjs: la auditoría dice "esto está mal, corregilo
// antes de cerrar". Este motor dice "esto está bien o mal en términos de
// gestión, y esto es lo que normalmente se hace al respecto" — son preguntas
// distintas, por eso viven separadas. Cada KPI es una función independiente,
// determinística, con fórmula visible — nada de puntaje compuesto ni caja
// negra. Si un cliente pregunta "¿de dónde sale este número?", la respuesta
// tiene que poder mostrarse en una línea de código, no en un modelo entrenado.

function round1(v) {
  return Math.round(v * 10) / 10;
}

// ────────────────────────────────────────────────────────────
// 1. Horas extra como % de la masa salarial
// ────────────────────────────────────────────────────────────

function kpiHorasExtraPctMasa({ liquidacionDetalle, masaSalarial }, umbralAlerta = 15) {
  const totalHorasExtra = liquidacionDetalle
    .filter((d) => d.conceptoCodigo.startsWith("HS_EXTRA"))
    .reduce((a, d) => a + d.importe, 0);
  const pct = masaSalarial > 0 ? round1((totalHorasExtra / masaSalarial) * 100) : 0;
  const semaforo = pct > umbralAlerta ? "amarillo" : "verde";
  return {
    tipo: "horas_extra_pct_masa",
    valor: pct,
    unidad: "%",
    semaforo,
    insight:
      pct > umbralAlerta
        ? `Las horas extra representan el ${pct}% de la masa salarial (umbral de referencia: ${umbralAlerta}%). Suele ser más barato evaluar una incorporación que sostener este nivel de manera estructural.`
        : `Las horas extra representan el ${pct}% de la masa salarial, dentro de un rango manejable.`,
  };
}

// ────────────────────────────────────────────────────────────
// 2. Rotación anualizada
// ────────────────────────────────────────────────────────────

function kpiRotacionAnualizada({ altasUltimos12Meses, bajasUltimos12Meses, dotacionPromedio }, umbralAlerta = 20) {
  const pct = dotacionPromedio > 0 ? round1(((altasUltimos12Meses + bajasUltimos12Meses) / 2 / dotacionPromedio) * 100) : 0;
  const semaforo = pct > umbralAlerta ? "amarillo" : "verde";
  return {
    tipo: "rotacion_anualizada",
    valor: pct,
    unidad: "%",
    semaforo,
    insight:
      pct > umbralAlerta
        ? `Rotación anualizada del ${pct}% (referencia: ${umbralAlerta}%). Vale la pena revisar si concentra en un sector o categoría puntual, antes de asumir que es un problema general.`
        : `Rotación anualizada del ${pct}%, dentro de un rango estable para el sector.`,
  };
}

// ────────────────────────────────────────────────────────────
// 3. Tendencia de ausentismo (últimos N meses)
// ────────────────────────────────────────────────────────────

function kpiTendenciaAusentismo({ indiceAusentismoPorMes }) {
  const n = indiceAusentismoPorMes.length;
  if (n < 2) return { tipo: "tendencia_ausentismo", valor: null, insight: "Datos insuficientes para calcular tendencia." };
  const primero = indiceAusentismoPorMes[0].indice;
  const ultimo = indiceAusentismoPorMes[n - 1].indice;
  const variacion = round1(ultimo - primero); // en puntos porcentuales, no % relativo — más legible para este indicador
  const semaforo = variacion > 1.5 ? "amarillo" : variacion < -1.5 ? "verde" : "verde";
  return {
    tipo: "tendencia_ausentismo",
    valor: variacion,
    unidad: "pp",
    semaforo,
    insight:
      variacion > 1.5
        ? `El ausentismo subió ${variacion} puntos porcentuales en los últimos ${n} meses (de ${primero}% a ${ultimo}%). Conviene mirar si se concentra en algún sector antes de que se vuelva costumbre.`
        : variacion < -1.5
        ? `El ausentismo bajó ${Math.abs(variacion)} puntos porcentuales en los últimos ${n} meses — tendencia favorable.`
        : `El ausentismo se mantuvo estable en los últimos ${n} meses (${primero}% → ${ultimo}%).`,
  };
}

// ────────────────────────────────────────────────────────────
// 4. Pirámide de antigüedad — concentración en los extremos
// ────────────────────────────────────────────────────────────

function kpiPiramideAntiguedad({ legajosActivos, hoy }) {
  const anios = legajosActivos.map((l) => (hoy - new Date(l.fechaIngreso)) / (365.25 * 24 * 3600 * 1000));
  const menorA1 = anios.filter((a) => a < 1).length;
  const mayorA10 = anios.filter((a) => a >= 10).length;
  const total = legajosActivos.length;
  const pctNuevos = total > 0 ? round1((menorA1 / total) * 100) : 0;
  const pctSenior = total > 0 ? round1((mayorA10 / total) * 100) : 0;

  const alertas = [];
  if (pctNuevos > 30) alertas.push(`${pctNuevos}% de la dotación tiene menos de 1 año de antigüedad — curva de aprendizaje activa en una porción significativa del equipo.`);
  if (pctSenior > 0 && pctSenior <= 15 && mayorA10 <= 2) {
    alertas.push(`Solo ${mayorA10} persona${mayorA10 !== 1 ? "s" : ""} con 10+ años en la empresa — si se van, se van con conocimiento que nadie más tiene documentado.`);
  }

  return {
    tipo: "piramide_antiguedad",
    valor: { pctNuevos, pctSenior },
    semaforo: alertas.length > 0 ? "amarillo" : "verde",
    insight: alertas.length > 0 ? alertas.join(" ") : `Distribución de antigüedad balanceada (${pctNuevos}% con menos de 1 año, ${pctSenior}% con 10 años o más).`,
  };
}

// ────────────────────────────────────────────────────────────
// 5. Empleados cerca del piso de escala (riesgo de reclamo, no auditoría de error)
// ────────────────────────────────────────────────────────────

function kpiCercaDePisoDeEscala({ liquidaciones, legajos, escalas }, margenPct = 5) {
  const enRiesgo = [];
  for (const liq of liquidaciones) {
    const legajo = legajos.find((l) => l.id === liq.legajoId);
    const escala = escalas.find((e) => e.categoriaId === legajo.categoriaId);
    if (!escala) continue;
    const margen = ((liq.bruto - escala.basico) / escala.basico) * 100;
    if (margen >= 0 && margen <= margenPct) {
      enRiesgo.push({ legajo: legajo.numero, apellido: legajo.apellido, margen: round1(margen) });
    }
  }
  return {
    tipo: "cerca_de_piso_escala",
    valor: enRiesgo.length,
    semaforo: enRiesgo.length > 0 ? "amarillo" : "verde",
    insight:
      enRiesgo.length > 0
        ? `${enRiesgo.length} empleado${enRiesgo.length > 1 ? "s están" : " está"} a menos de ${margenPct}% del básico de su escala. No es un error (eso lo marca la auditoría), pero un ajuste de convenio los deja por debajo si no se revisan a tiempo.`
        : `Ningún empleado está cerca del piso de su escala vigente.`,
    detalle: enRiesgo,
  };
}

// ────────────────────────────────────────────────────────────
// 6. Proyección simple del costo laboral del próximo período
// ────────────────────────────────────────────────────────────

function kpiProyeccionCostoLaboral({ costoLaboralPorMes }) {
  const n = costoLaboralPorMes.length;
  if (n < 3) return { tipo: "proyeccion_costo_laboral", valor: null, insight: "Se necesitan al menos 3 períodos para proyectar." };
  // Tasa de crecimiento promedio mes a mes de los últimos n períodos — proyección simple,
  // no un pronóstico econométrico. Se etiqueta como tal en el insight a propósito.
  const tasas = [];
  for (let i = 1; i < n; i++) {
    tasas.push((costoLaboralPorMes[i].valor - costoLaboralPorMes[i - 1].valor) / costoLaboralPorMes[i - 1].valor);
  }
  const tasaPromedio = tasas.reduce((a, b) => a + b, 0) / tasas.length;
  const ultimo = costoLaboralPorMes[n - 1].valor;
  const proyeccion = Math.round(ultimo * (1 + tasaPromedio));

  return {
    tipo: "proyeccion_costo_laboral",
    valor: proyeccion,
    unidad: "$",
    semaforo: "verde",
    insight:
      `Proyección simple (promedio de variación mensual de los últimos ${n} períodos, no un pronóstico econométrico): ` +
      `si la tendencia se mantiene, el costo laboral del próximo período rondaría $${proyeccion.toLocaleString("es-AR")} ` +
      `(${tasaPromedio >= 0 ? "+" : ""}${round1(tasaPromedio * 100)}% respecto del último período informado).`,
  };
}

const KPIS = [
  kpiHorasExtraPctMasa,
  kpiRotacionAnualizada,
  kpiTendenciaAusentismo,
  kpiPiramideAntiguedad,
  kpiCercaDePisoDeEscala,
  kpiProyeccionCostoLaboral,
];

export {
  kpiHorasExtraPctMasa,
  kpiRotacionAnualizada,
  kpiTendenciaAusentismo,
  kpiPiramideAntiguedad,
  kpiCercaDePisoDeEscala,
  kpiProyeccionCostoLaboral,
  KPIS,
};
