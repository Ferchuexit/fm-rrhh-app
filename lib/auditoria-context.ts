// FM RRHH — lib/auditoria-context.ts
// Compartido entre /api/auditar y /api/cerrar — antes cada ruta iba a armar
// su propia versión de este contexto, con el riesgo real (ya pasó dos veces
// en este proyecto) de que las dos copias se desalinearan con el tiempo.
import { prisma } from "./prisma";
import { auditarPeriodo } from "./motor/motor-auditoria.mjs";
import { whereDeFiltro } from "./liquidar-filtro";

async function obtenerResultadoAuditoria(periodoId: string) {
  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });

  const liquidacionesDb = await prisma.liquidacion.findMany({ where: { periodoId } });
  const liquidaciones = liquidacionesDb.map((l) => ({ legajoId: l.legajoId, bruto: l.bruto, neto: l.neto }));

  // Mismo filtro que /liquidar, /recibos y /novedades — si el período tiene
  // un convenio fijado (ej. una quincena solo para Madera), la auditoría
  // solo debe pedir cuentas de ESE convenio, no de toda la empresa. Antes
  // esto se ignoraba acá — "sin liquidar" avisaba por Comercio y los
  // directores en un período que nunca fue para ellos.
  const whereLegajos = whereDeFiltro(periodo.empresaId, { modo: "todos" }, periodo.convenioId);
  const legajosDb = await prisma.legajo.findMany({ where: whereLegajos });
  const legajos = legajosDb.map((l) => ({
    id: l.id,
    numero: l.numeroLegajo,
    apellido: l.apellido,
    nombre: l.nombre,
    cuil: l.cuil,
    categoriaId: l.categoriaId,
    convenioId: l.convenioId,
    condicion: l.condicion,
    obraSocialId: l.obraSocialId,
    cbu: l.cbu,
    bancoId: l.bancoId,
  }));

  // Fórmula del básico por convenio — para saber si "sin novedades" importa
  // de verdad (Madera, que depende de horas reales) o no (Comercio, básico
  // mensual fijo que no usa HORAS_TRABAJADAS). Ver 63-novedades-horas-reales.md.
  const reglasBasicoDb = await prisma.reglaConcepto.findMany({
    where: { concepto: { codigo: "REM_BASICA" }, vigenciaHasta: null },
  });
  const formulaBasicoPorConvenio: Record<string, string> = Object.fromEntries(
    reglasBasicoDb.map((r) => [r.convenioId, r.formula])
  );

  const escalas = await prisma.escala.findMany();

  const fechaDesde = periodo.fechaDesde;
  const fechaHasta = periodo.fechaHasta;
  const novedadesDb = await prisma.novedad.findMany({
    where: { legajo: { empresaId: periodo.empresaId }, periodo: { gte: fechaDesde, lte: fechaHasta } },
  });
  const novedades = novedadesDb.map((n) => ({ legajoId: n.legajoId, createdAt: n.createdAt.toISOString(), conceptoId: n.conceptoId }));

  // Para poder distinguir "tiene novedad de horas reales" de "tiene
  // cualquier otra novedad" (adelanto, premio, etc.) — la regla de "sin
  // novedades" ahora necesita saber específicamente si falta la de horas,
  // no si falta cualquiera.
  const conceptoHoras = await prisma.concepto.findUnique({ where: { codigo: "HS_NORMALES" } });
  const legajosConHorasCargadas = conceptoHoras
    ? new Set(novedadesDb.filter((n) => n.conceptoId === conceptoHoras.id).map((n) => n.legajoId))
    : new Set<string>();

  // "Período anterior" ya no se busca por mes-1/año-1 (eso solo tenía sentido
  // cuando un período SIEMPRE era un mes calendario completo). Ahora se busca
  // por fecha real: el período más reciente de esta empresa que haya
  // terminado antes de que empiece este — funciona igual para mensuales y
  // quincenas, sin asumir una cadencia fija.
  const periodoAnterior = await prisma.periodo.findFirst({
    where: { empresaId: periodo.empresaId, fechaHasta: { lt: fechaDesde } },
    orderBy: { fechaHasta: "desc" },
  });
  const liquidacionesMesAnteriorDb = periodoAnterior
    ? await prisma.liquidacion.findMany({ where: { periodoId: periodoAnterior.id } })
    : [];
  const liquidacionesMesAnterior = liquidacionesMesAnteriorDb.map((l) => ({ legajoId: l.legajoId, bruto: l.bruto }));

  return auditarPeriodo({
    liquidaciones,
    legajos,
    escalas,
    liquidacionesMesAnterior,
    novedades,
    formulaBasicoPorConvenio,
    legajosConHorasCargadas: [...legajosConHorasCargadas],
    periodo: { fechaTopeCarga: null },
  });
}

async function obtenerResultadoAuditoriaPreliquidacion(periodoId: string) {
  // Mismo espíritu que obtenerResultadoAuditoria, pero SIN pedir
  // liquidaciones — corre solo las reglas etiquetadas 'pre' en
  // motor-auditoria.mjs (datos faltantes, CUIL inválido, sin obra social,
  // novedades fuera de término, sin novedad de horas). Pensado para
  // correr ANTES de liquidar, cuando todavía no hay ningún resultado que
  // auditar.
  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });

  const whereLegajos = whereDeFiltro(periodo.empresaId, { modo: "todos" }, periodo.convenioId);
  const legajosDb = await prisma.legajo.findMany({ where: whereLegajos });
  const legajos = legajosDb.map((l) => ({
    id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, cuil: l.cuil,
    categoriaId: l.categoriaId, convenioId: l.convenioId, condicion: l.condicion,
    obraSocialId: l.obraSocialId, cbu: l.cbu, bancoId: l.bancoId,
  }));

  const reglasBasicoDb = await prisma.reglaConcepto.findMany({ where: { concepto: { codigo: "REM_BASICA" }, vigenciaHasta: null } });
  const formulaBasicoPorConvenio: Record<string, string> = Object.fromEntries(reglasBasicoDb.map((r) => [r.convenioId, r.formula]));

  const novedadesDb = await prisma.novedad.findMany({
    where: { legajo: { empresaId: periodo.empresaId }, periodo: { gte: periodo.fechaDesde, lte: periodo.fechaHasta } },
  });
  const novedades = novedadesDb.map((n) => ({ legajoId: n.legajoId, createdAt: n.createdAt.toISOString(), conceptoId: n.conceptoId }));

  const conceptoHoras = await prisma.concepto.findUnique({ where: { codigo: "HS_NORMALES" } });
  const legajosConHorasCargadas = conceptoHoras
    ? new Set(novedadesDb.filter((n) => n.conceptoId === conceptoHoras.id).map((n) => n.legajoId))
    : new Set<string>();

  return auditarPeriodo(
    {
      legajos, novedades, formulaBasicoPorConvenio,
      legajosConHorasCargadas: [...legajosConHorasCargadas],
      periodo: { fechaTopeCarga: null },
    },
    { momento: "pre" }
  );
}

export { obtenerResultadoAuditoria, obtenerResultadoAuditoriaPreliquidacion };
