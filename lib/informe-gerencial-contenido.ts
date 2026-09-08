// FM RRHH — lib/informe-gerencial-contenido.ts
//
// Arma el CONTENIDO del informe (textos, no el .docx en sí) a partir de
// los datos que YA calculan centro-control.ts y auditoria-context.ts —
// esta función es pura (no toca Prisma), para poder probarla con casos a
// mano. La generación del archivo .docx vive aparte, en
// app/api/informe-gerencial/route.ts.
//
// El "resumen ejecutivo" y las "recomendaciones" NO se generan con un LLM
// — son texto armado con reglas simples a partir de los números reales
// (umbrales fijos, ej. "> 10% de aumento"). Es menos elegante que un texto
// libre, pero es determinístico: el mismo dato siempre da el mismo texto,
// se puede auditar por qué dijo lo que dijo, y no depende de un servicio
// externo para generar un informe gerencial.

interface DatosInforme {
  periodoActual: { nombre: string };
  periodoAnterior: { nombre: string } | null;
  costoLaboral: { actual: number; variacionPct: number | null };
  dotacion: { actual: number; anterior: number | null };
  ausentismoPct: { actual: number | null; variacionPuntos: number | null };
  horasExtra: { actual: number; variacionPct: number | null };
  costoPorEmpleado: { actual: number; variacionPct: number | null };
  alertas: { rojas: number; amarillas: number };
  distribucionPorConvenio: { convenio: string; cantidad: number; costoLaboral: number }[];
  desvios: { severidad: string; mensaje: string }[];
}

function money(n: number): string {
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function pct(n: number, decimales = 1): string {
  const signo = n > 0 ? "+" : "";
  return `${signo}${n.toFixed(decimales)}%`;
}

export function armarResumenEjecutivo(d: DatosInforme): string {
  if (!d.periodoAnterior) {
    return `Informe correspondiente a ${d.periodoActual.nombre}. Costo laboral total: ${money(d.costoLaboral.actual)}, con una dotación de ${d.dotacion.actual} empleados. No hay un período anterior cargado para comparar variaciones.`;
  }

  const partes: string[] = [
    `Informe correspondiente a ${d.periodoActual.nombre}, comparado contra ${d.periodoAnterior.nombre}.`,
  ];

  partes.push(
    `El costo laboral total fue de ${money(d.costoLaboral.actual)}${
      d.costoLaboral.variacionPct !== null ? ` (${pct(d.costoLaboral.variacionPct)} respecto al período anterior)` : ""
    }, con una dotación de ${d.dotacion.actual} empleados${
      d.dotacion.anterior !== null ? ` (${d.dotacion.actual - d.dotacion.anterior >= 0 ? "+" : ""}${d.dotacion.actual - d.dotacion.anterior} respecto al período anterior)` : ""
    }.`
  );

  if (d.ausentismoPct.actual !== null) {
    partes.push(
      `El ausentismo estimado fue del ${d.ausentismoPct.actual.toFixed(1)}%${
        d.ausentismoPct.variacionPuntos !== null
          ? ` (${d.ausentismoPct.variacionPuntos >= 0 ? "+" : ""}${d.ausentismoPct.variacionPuntos.toFixed(1)} puntos respecto al período anterior)`
          : ""
      }.`
    );
  }

  if (d.alertas.rojas > 0 || d.alertas.amarillas > 0) {
    partes.push(`La auditoría del período detectó ${d.alertas.rojas} alerta(s) roja(s) y ${d.alertas.amarillas} observación(es).`);
  } else {
    partes.push("La auditoría del período no detectó alertas ni observaciones.");
  }

  return partes.join(" ");
}

export function armarRecomendaciones(d: DatosInforme): string[] {
  const recomendaciones: string[] = [];

  if (d.costoLaboral.variacionPct !== null && d.costoLaboral.variacionPct > 10) {
    recomendaciones.push(
      `El costo laboral aumentó ${pct(d.costoLaboral.variacionPct)} respecto al período anterior — un incremento superior al 10% amerita revisar si responde a un aumento paritario, más horas extra, o cambios en la dotación.`
    );
  }

  if (d.ausentismoPct.variacionPuntos !== null && d.ausentismoPct.variacionPuntos > 1) {
    recomendaciones.push(
      `El ausentismo subió ${d.ausentismoPct.variacionPuntos.toFixed(1)} puntos porcentuales — vale la pena identificar si se concentra en algún sector o legajo puntual.`
    );
  }

  if (d.horasExtra.variacionPct !== null && d.horasExtra.variacionPct > 15) {
    recomendaciones.push(
      `Las horas extra aumentaron ${pct(d.horasExtra.variacionPct)} — un aumento sostenido puede indicar necesidad de reforzar la dotación en vez de sostener el sobretiempo.`
    );
  }

  if (d.alertas.rojas > 0) {
    recomendaciones.push(`Hay ${d.alertas.rojas} alerta(s) roja(s) sin resolver en la auditoría del período — revisar en /auditoria antes de dar el período por cerrado.`);
  }

  if (recomendaciones.length === 0) {
    recomendaciones.push("No se detectaron desvíos que ameriten una recomendación puntual en este período.");
  }

  return recomendaciones;
}
