// FM RRHH — lib/indicadores.ts
// Junta los datos del tablero de indicadores leyendo de cada módulo. Cada
// bloque va en su try: si uno falla (una tabla que falta en esa base), los
// demás se muestran igual y ese queda "sin datos".
//
// El alcance del usuario se aplica solo (prisma): quien está limitado a
// sectores ve los indicadores de su gente.
import { prisma } from "./prisma";
import { resumenEmpresa } from "./legajo-digital";
import { resultados, type Pregunta } from "./encuestas-reglas";
import { MOTIVOS_EGRESO, MOTIVOS_ENTREVISTA } from "./egresos-reglas";
import { FUENTES, ETAPAS } from "./reclutamiento-reglas";
import { estadoEpp } from "./epp";
import * as R from "./indicadores-reglas";
export * from "./indicadores-reglas";

const DIA = 86400000;
async function bloque<T>(nombre: string, hacer: () => Promise<T>): Promise<T | null> {
  try { return await hacer(); } catch (e) { console.error(`Indicadores: falló "${nombre}":`, (e as Error)?.message); return null; }
}
const contar = <T,>(lista: T[], clave: (x: T) => string | null | undefined, nombres: Record<string, string> = {}) =>
  Object.entries(lista.reduce<Record<string, number>>((a, x) => { const k = clave(x); return k ? { ...a, [k]: (a[k] ?? 0) + 1 } : a; }, {})).map(([k, cantidad]) => ({ clave: k, nombre: nombres[k] ?? k, cantidad })).sort((a, b) => b.cantidad - a.cantidad);

// `meses`: cuántos meses mira (3, 6 o 12). `sectorId`: un sector, o null = toda la empresa.
export async function indicadores(empresaId: string, hoy: Date, meses: number, sectorId: string | null) {
  const periodo = R.ultimosMeses(hoy, meses);
  const desde = periodo[0].desde;
  const deSector = sectorId ? { centroCostoId: sectorId } : {};
  const deGente = { legajo: { empresaId, ...deSector } };

  const [sectores, todos] = await Promise.all([
    prisma.centroCosto.findMany({ where: { empresaId }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.legajo.findMany({ where: { empresaId, ...deSector }, select: { id: true, nombre: true, apellido: true, fechaIngreso: true, fechaEgreso: true, condicion: true, motivoBaja: true, centroCostoId: true, puestoId: true, accesoPortal: { select: { activo: true, ultimoIngreso: true } } } }),
  ]);
  const activos = todos.filter((l) => l.condicion === "activo");
  const idsActivos = activos.map((l) => l.id);
  const nombreDe = new Map(todos.map((l) => [l.id, `${l.apellido}, ${l.nombre}`]));
  const sectorDe = new Map(sectores.map((s) => [s.id, s.nombre]));

  // ── Dotación y rotación ──
  const dotacion = await bloque("dotación", async () => {
    // El motivo sale del proceso de egreso si lo hubo; si no, del legajo.
    const egresos = await prisma.egreso.findMany({ where: { ...deGente, estado: { not: "cancelado" } }, select: { legajoId: true, motivo: true } });
    const motivoDe = new Map(egresos.map((e) => [e.legajoId, e.motivo]));
    const personas: R.PersonaDotacion[] = todos.map((l) => ({ id: l.id, fechaIngreso: l.fechaIngreso, fechaEgreso: l.fechaEgreso, activo: l.condicion === "activo", motivo: motivoDe.get(l.id) ?? null }));
    const rot = R.rotacion(personas, desde, hoy);
    return {
      activos: activos.length, antiguedad: R.antiguedadPromedio(personas, hoy),
      porSector: contar(activos, (l) => (l.centroCostoId ? sectorDe.get(l.centroCostoId) ?? "Sin sector" : "Sin sector")),
      movimiento: R.movimientoPorMes(personas, periodo),
      rotacion: { ...rot, porMotivo: rot.porMotivo.map((m) => ({ ...m, nombre: m.clave === "sin_motivo" ? "Sin motivo cargado" : MOTIVOS_EGRESO[m.clave] ?? m.clave })) },
      bajasSinFecha: todos.filter((l) => l.condicion !== "activo" && !l.fechaEgreso).length,
      conPortal: R.pct(activos.filter((l) => l.accesoPortal?.activo).length, activos.length),
      usanPortal: R.pct(activos.filter((l) => l.accesoPortal?.ultimoIngreso && l.accesoPortal.ultimoIngreso.getTime() >= hoy.getTime() - 30 * DIA).length, activos.length),
    };
  });

  // ── Ausentismo ──
  const ausentismo = await bloque("ausentismo", async () => {
    const dias = await prisma.asistenciaDia.findMany({ where: { ...deGente, fecha: { gte: desde, lte: hoy } }, select: { legajoId: true, fecha: true, estado: true } });
    const total = R.ausentismo(dias);
    const porSector = sectorId ? [] : sectores.map((s) => { const ids = new Set(todos.filter((l) => l.centroCostoId === s.id).map((l) => l.id)); const a = R.ausentismo(dias.filter((d) => ids.has(d.legajoId))); return { nombre: s.nombre, tasa: a.tasa, laborables: a.laborables }; }).filter((s) => s.tasa !== null);
    // Quiénes concentran las faltas sin justificar (sin aviso + con aviso).
    const faltas = contar(dias.filter((d) => ["injustificada", "aviso"].includes(R.tipoDe(d.estado) ?? "")), (d) => d.legajoId).slice(0, 5).map((f) => ({ nombre: nombreDe.get(f.clave) ?? "?", cantidad: f.cantidad }));
    return {
      hayDatos: total.laborables > 0, ...total, porMes: R.ausentismoPorMes(dias, periodo), porSector, faltas,
      prolongadas: R.licenciasProlongadas(dias, hoy).map((p) => ({ ...p, nombre: nombreDe.get(p.legajoId) ?? "?" })),
      suspendidos: new Set(dias.filter((d) => d.estado === "SUS").map((d) => d.legajoId)).size,
      accidentados: new Set(dias.filter((d) => R.tipoDe(d.estado) === "art").map((d) => d.legajoId)).size,
    };
  });

  // ── Vacaciones y permisos a futuro ──
  const vacaciones = await bloque("vacaciones", async () => {
    const [vacs, pendientes] = await Promise.all([
      prisma.vacacion.findMany({ where: { ...deGente, fechaHasta: { gte: hoy } }, select: { legajoId: true, fechaDesde: true, fechaHasta: true } }),
      prisma.solicitudAusencia.count({ where: { ...deGente, estado: "pendiente" } }),
    ]);
    return { ...R.vacacionesAFuturo(vacs, hoy), pedidosSinResponder: pendientes };
  });

  // ── Clima (encuestas cerradas; no se abre por sector: son anónimas) ──
  const clima = await bloque("clima", async () => {
    const encuestas = await prisma.encuesta.findMany({ where: { empresaId, estado: "cerrada" }, orderBy: { fechaCierre: "asc" }, take: 12, include: { respuestas: { select: { sector: true, respuestas: true } }, _count: { select: { participaciones: true } } } });
    const lista = [];
    for (const e of encuestas) {
      const r = resultados(e.preguntas as unknown as Pregunta[], e.respuestas, e.id);
      if (!r.suficientes) continue;
      const invitados = await prisma.legajo.count({ where: { empresaId, condicion: "activo", ...(e.centroCostoIds.length ? { centroCostoId: { in: e.centroCostoIds } } : {}) } });
      const todas = r.porDimension.flatMap((d) => (d.favorable === null ? [] : [d.favorable]));
      lista.push({ id: e.id, titulo: e.titulo, fecha: e.fechaCierre, respuestas: r.total, participacion: R.pct(r.total, Math.max(invitados, r.total)), favorable: R.promedio(todas), enps: r.enps?.puntaje ?? null, dimensiones: r.porDimension });
    }
    return { encuestas: lista.map(({ dimensiones, ...e }) => e), ultima: lista[lista.length - 1] ?? null, abiertas: await prisma.encuesta.count({ where: { empresaId, estado: "abierta" } }) };
  });

  // ── Documentación (legajo digital) ──
  const documentacion = await bloque("documentación", async () => {
    const filas = (await resumenEmpresa(empresaId)).filter((f) => !sectorId || idsActivos.includes(f.legajoId));
    const requeridos = filas.flatMap((f) => f.items.filter((i) => i.requerido));
    return {
      legajos: filas.length, completos: filas.filter((f) => f.resumen.completo).length,
      pctLegajos: R.pct(filas.filter((f) => f.resumen.completo).length, filas.length),
      pctItems: R.pct(requeridos.filter((i) => i.estado === "completo").length, requeridos.length),
      pendientesEmpleado: filas.reduce((a, f) => a + f.resumen.pendientesEmpleado, 0), pendientesRrhh: filas.reduce((a, f) => a + f.resumen.pendientesRrhh, 0),
      // Qué es lo que más falta: por dónde conviene empujar.
      faltantes: contar(requeridos.filter((i) => i.estado !== "completo"), (i) => i.nombre).slice(0, 8),
      porItem: contar(requeridos, (i) => i.nombre).map((t) => ({ nombre: t.nombre, total: t.cantidad, completos: requeridos.filter((i) => i.nombre === t.nombre && i.estado === "completo").length })).map((t) => ({ ...t, pct: R.pct(t.completos, t.total) })).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)),
    };
  });

  // ── Capacitación y habilitaciones ──
  const capacitacion = await bloque("capacitación", async () => {
    const [caps, habilidades] = await Promise.all([
      prisma.capacitacion.findMany({ where: { empresaId, fecha: { gte: desde } }, select: { id: true, tipo: true, fecha: true, horas: true, estado: true } }),
      prisma.habilidadLegajo.findMany({ where: { legajoId: { in: idsActivos }, vence: { not: null } }, select: { vence: true } }),
    ]);
    const asistentes = await prisma.asistenteCapacitacion.findMany({ where: { capacitacionId: { in: caps.map((c) => c.id) }, legajoId: { in: todos.map((l) => l.id) } }, select: { capacitacionId: true, legajoId: true, asistio: true, firmadoEn: true } });
    const realizadas = caps.filter((c) => c.estado === "realizada");
    const deRealizadas = asistentes.filter((a) => realizadas.some((c) => c.id === a.capacitacionId));
    const fueron = deRealizadas.filter((a) => a.asistio === true);
    const horasDe = new Map(realizadas.map((c) => [c.id, c.horas ?? 0]));
    const horasPersona = fueron.reduce((a, x) => a + (horasDe.get(x.capacitacionId) ?? 0), 0);
    const TIPOS: Record<string, string> = { seguridad: "Seguridad", tecnica: "Técnica", induccion: "Inducción", otra: "Otra" };
    return {
      realizadas: realizadas.length, programadas: caps.filter((c) => c.estado === "programada" && c.fecha >= hoy).length, atrasadas: caps.filter((c) => c.estado === "programada" && c.fecha < hoy).length,
      convocados: deRealizadas.length, asistencia: R.pct(fueron.length, deRealizadas.filter((a) => a.asistio !== null).length),
      horasPersona: Math.round(horasPersona * 10) / 10, horasPorEmpleado: activos.length ? Math.round((horasPersona / activos.length) * 10) / 10 : null,
      capacitados: R.pct(new Set(fueron.filter((a) => idsActivos.includes(a.legajoId)).map((a) => a.legajoId)).size, activos.length),
      sinFirmar: fueron.filter((a) => !a.firmadoEn).length,
      porTipo: contar(realizadas, (c) => c.tipo, TIPOS),
      porMes: periodo.map((m) => ({ mes: m.rotulo, realizadas: realizadas.filter((c) => c.fecha >= m.desde && c.fecha <= m.hasta).length })),
      habVencidas: habilidades.filter((h) => h.vence! < hoy).length, habPorVencer: habilidades.filter((h) => h.vence! >= hoy && h.vence!.getTime() <= hoy.getTime() + 60 * DIA).length,
    };
  });

  // ── EPP y ropa de trabajo ──
  const epp = await bloque("epp", async () => {
    const e = await estadoEpp(empresaId, hoy, sectorId);
    return { catalogo: e.elementos.filter((x) => x.activo).length, ...e.resumen, porElemento: e.porElemento };
  });

  // ── Onboarding y offboarding ──
  const ingresos = await bloque("onboarding", async () => {
    const lista = await prisma.ingreso.findMany({ where: { ...deGente, estado: { not: "cancelado" }, OR: [{ estado: "en_curso" }, { createdAt: { gte: desde } }] }, select: { estado: true, fechaIngreso: true, cerradoEn: true, tareas: { select: { vence: true, hechaEn: true, estado: true, responsable: true } } } });
    const tareas = lista.flatMap((i) => i.tareas.map((t) => ({ vence: t.vence, hechaEn: t.estado === "hecha" ? t.hechaEn ?? t.vence : null, aplica: t.estado !== "no_aplica", responsable: t.responsable })));
    const cerrados = lista.filter((i) => i.estado === "completado" && i.cerradoEn);
    const RESP: Record<string, string> = { rrhh: "RR.HH.", jefe: "Jefe directo", empleado: "El empleado" };
    return {
      enCurso: lista.filter((i) => i.estado === "en_curso").length, completados: cerrados.length, ...R.cumplimientoTareas(tareas, hoy),
      diasPromedio: R.promedio(cerrados.map((i) => Math.max(0, Math.round((i.cerradoEn!.getTime() - i.fechaIngreso.getTime()) / DIA)))),
      vencidasPor: contar(tareas.filter((t) => t.aplica && !t.hechaEn && t.vence < hoy), (t) => t.responsable, RESP),
    };
  });
  const egresos = await bloque("offboarding", async () => {
    const lista = await prisma.egreso.findMany({ where: { ...deGente, estado: { not: "cancelado" }, OR: [{ estado: "en_curso" }, { fechaEgreso: { gte: desde } }] }, select: { estado: true, motivo: true, entrevistaMotivo: true, recontratable: true, tareas: { select: { vence: true, hechaEn: true, estado: true } } } });
    const tareas = lista.flatMap((e) => e.tareas.map((t) => ({ vence: t.vence, hechaEn: t.estado === "hecha" ? t.hechaEn ?? t.vence : null, aplica: t.estado !== "no_aplica" })));
    // La entrevista de salida tiene sentido cuando la persona eligió irse.
    const voluntarios = lista.filter((e) => R.MOTIVOS_VOLUNTARIOS.includes(e.motivo));
    return {
      enCurso: lista.filter((e) => e.estado === "en_curso").length, procesos: lista.length, ...R.cumplimientoTareas(tareas, hoy),
      entrevistas: R.pct(voluntarios.filter((e) => e.entrevistaMotivo).length, voluntarios.length), sinEntrevista: voluntarios.filter((e) => !e.entrevistaMotivo).length,
      motivosReales: contar(lista, (e) => e.entrevistaMotivo, MOTIVOS_ENTREVISTA),
      recontratables: contar(lista, (e) => e.recontratable, { si: "Sí", con_reservas: "Con reservas", no: "No" }),
    };
  });

  // ── Vacantes y reclutamiento (de la empresa; no se abre por sector) ──
  const reclutamiento = await bloque("reclutamiento", async () => {
    const [puestos, busquedas] = await Promise.all([
      prisma.puesto.findMany({ where: { empresaId, ...(sectorId ? { centroCostoId: sectorId } : {}) }, select: { id: true, nombre: true, dotacion: true } }),
      prisma.busqueda.findMany({ where: { empresaId, OR: [{ estado: { in: ["abierta", "pausada"] } }, { cerradaEn: { gte: desde } }] }, select: { id: true, titulo: true, estado: true, motivoCierre: true, abiertaEn: true, cerradaEn: true, vacantes: true } }),
    ]);
    const candidatos = await prisma.candidato.findMany({ where: { busquedaId: { in: busquedas.map((b) => b.id) } }, select: { busquedaId: true, etapa: true, fuente: true } });
    const ocupan = (id: string) => activos.filter((l) => l.puestoId === id).length;
    const porPuesto = puestos.map((p) => ({ nombre: p.nombre, vacantes: Math.max(0, p.dotacion - ocupan(p.id)), dotacion: p.dotacion })).filter((p) => p.vacantes > 0).sort((a, b) => b.vacantes - a.vacantes);
    const abiertas = busquedas.filter((b) => b.estado === "abierta");
    const cubiertas = busquedas.filter((b) => b.estado === "cerrada" && b.motivoCierre === "cubierta" && b.abiertaEn && b.cerradaEn);
    const diasAbierta = (b: { abiertaEn: Date | null }) => (b.abiertaEn ? Math.max(0, Math.round((hoy.getTime() - b.abiertaEn.getTime()) / DIA)) : 0);
    return {
      hayPuestos: puestos.length > 0, vacantes: porPuesto.reduce((a, p) => a + p.vacantes, 0), dotacionTeorica: puestos.reduce((a, p) => a + p.dotacion, 0), porPuesto: porPuesto.slice(0, 8),
      abiertas: abiertas.length, viejas: abiertas.filter((b) => diasAbierta(b) > 30).length, diasAbiertas: R.promedio(abiertas.map(diasAbierta)),
      cubiertas: cubiertas.length, diasCobertura: R.promedio(cubiertas.map((b) => Math.round((b.cerradaEn!.getTime() - b.abiertaEn!.getTime()) / DIA))),
      candidatos: candidatos.length, sinRevisar: candidatos.filter((c) => c.etapa === "postulado" && abiertas.some((b) => b.id === c.busquedaId)).length,
      embudo: ETAPAS.filter((e) => e.clave !== "descartado").map((e, i, etapas) => ({ etapa: e.nombre, cantidad: candidatos.filter((c) => etapas.slice(i).some((x) => x.clave === c.etapa)).length })),
      porFuente: contar(candidatos, (c) => c.fuente, FUENTES).map((f) => ({ ...f, contratados: candidatos.filter((c) => c.fuente === f.clave && c.etapa === "contratado").length })),
    };
  });

  // ── Desempeño y objetivos ──
  const desempeno = await bloque("desempeño", async () => {
    const [ciclo, objetivos] = await Promise.all([
      prisma.cicloEvaluacion.findFirst({ where: { empresaId }, orderBy: { createdAt: "desc" }, select: { id: true, nombre: true, estado: true, fechaLimite: true } }),
      prisma.objetivo.findMany({ where: { legajoId: { in: idsActivos }, estado: { not: "cancelado" }, OR: [{ estado: "en_curso" }, { cerradoEn: { gte: desde } }] }, select: { estado: true, fechaLimite: true, avance: true } }),
    ]);
    const evals = ciclo ? await prisma.evaluacion.findMany({ where: { cicloId: ciclo.id, legajoId: { in: todos.map((l) => l.id) } }, select: { estado: true, promedio: true } }) : [];
    const cerrados = objetivos.filter((o) => o.estado !== "en_curso");
    const enCurso = objetivos.filter((o) => o.estado === "en_curso");
    return {
      ciclo: ciclo ? { nombre: ciclo.nombre, abierto: ciclo.estado === "abierto", total: evals.length, pendientes: evals.filter((e) => e.estado === "pendiente").length, completadas: R.pct(evals.filter((e) => e.estado !== "pendiente").length, evals.length), firmadas: R.pct(evals.filter((e) => e.estado === "firmada").length, evals.length), promedio: R.promedio(evals.flatMap((e) => (e.promedio === null ? [] : [e.promedio]))),
        distribucion: [1, 2, 3, 4, 5].map((n) => ({ nota: String(n), cantidad: evals.filter((e) => e.promedio !== null && Math.round(e.promedio) === n).length })) } : null,
      objetivos: { enCurso: enCurso.length, vencidos: enCurso.filter((o) => o.fechaLimite < hoy).length, avance: R.promedio(enCurso.map((o) => o.avance)), cumplimiento: R.pct(cerrados.filter((o) => o.estado === "cumplido").length, cerrados.length), cerrados: cerrados.length },
    };
  });

  // ── Cultura y participación ──
  const cultura = await bloque("cultura", async () => {
    const d90 = new Date(hoy.getTime() - 90 * DIA);
    const [recs, eventos] = await Promise.all([
      prisma.reconocimiento.findMany({ where: { legajoId: { in: idsActivos }, oculto: false, createdAt: { gte: d90 } }, select: { legajoId: true, emisorId: true, valor: true } }),
      prisma.evento.findMany({ where: { empresaId, estado: "publicado", pideConfirmacion: true, fecha: { gte: desde, lte: hoy } }, select: { id: true } }),
    ]);
    const asist = await prisma.asistenciaEvento.findMany({ where: { eventoId: { in: eventos.map((e) => e.id) }, legajoId: { in: todos.map((l) => l.id) } }, select: { va: true, asistio: true } });
    const conAsistencia = asist.filter((a) => a.asistio !== null);
    return {
      reconocimientos: recs.length, reconocidos: R.pct(new Set(recs.map((r) => r.legajoId)).size, activos.length), reconocen: R.pct(new Set(recs.flatMap((r) => (r.emisorId ? [r.emisorId] : []))).size, activos.length),
      porValor: contar(recs, (r) => r.valor).slice(0, 6),
      eventos: eventos.length, confirmaron: asist.filter((a) => a.va).length, fueron: R.pct(conAsistencia.filter((a) => a.asistio).length, conAsistencia.length),
    };
  });

  const rotAnual = dotacion?.rotacion.anualizada ?? null;
  const lista = R.alertas({
    rotacionAnual: rotAnual, bajasTempranas: dotacion?.rotacion.tempranas ?? 0, ausentismo: ausentismo?.tasa ?? null, sinAviso: ausentismo?.porTipo.injustificada ?? 0, prolongadas: ausentismo?.prolongadas.length ?? 0,
    clima: clima?.ultima?.favorable ?? null, documentacion: documentacion?.pctLegajos ?? null, docPendientesRrhh: documentacion?.pendientesRrhh ?? 0,
    constanciasSinFirmar: capacitacion?.sinFirmar ?? 0, habilidadesVencidas: capacitacion?.habVencidas ?? 0, habilidadesPorVencer: capacitacion?.habPorVencer ?? 0,
    tareasIngresoVencidas: ingresos?.vencidas ?? 0, tareasEgresoVencidas: egresos?.vencidas ?? 0, egresosSinEntrevista: egresos?.sinEntrevista ?? 0,
    vacantes: reclutamiento?.vacantes ?? 0, busquedasViejas: reclutamiento?.viejas ?? 0, candidatosSinRevisar: reclutamiento?.sinRevisar ?? 0,
    evaluacionesPendientes: desempeno?.ciclo?.abierto ? desempeno.ciclo.pendientes : 0, objetivosVencidos: desempeno?.objetivos.vencidos ?? 0, picoVacaciones: vacaciones?.pico.personas ?? 0, dotacion: activos.length,
    eppSinProteccion: epp ? epp.personas - epp.protegidas : 0, eppPorVencer: epp?.porVencer ?? 0, eppSinFirmar: epp?.sinFirmar ?? 0,
  });

  return { hoy, meses, desde, sectores, sectorId, alertas: lista, referencias: R.REFERENCIAS, dotacion, ausentismo, vacaciones, clima, documentacion, capacitacion, epp, ingresos, egresos, reclutamiento, desempeno, cultura };
}
