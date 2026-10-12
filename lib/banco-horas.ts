// FM RRHH — lib/banco-horas.ts
// Lado base de datos del banco de horas (reglas en lib/banco-horas-reglas.ts).
import { prisma } from "./prisma";
import { horariosDeEmpresa, excepcionesEntre, jornadaDelDia, claveDia } from "./turnos";
import {
  lotes, minutosReservados, estadoAcuerdo, acuerdoDelDia, extraDelDia, alertasDePersona, horasAPagar, descansoQueGenera, textoHoras, horasDecimales,
  type MovMin, type AcuerdoMin, type DiaConExtra,
} from "./banco-horas-reglas";
export * from "./banco-horas-reglas";

const DIA_MS = 24 * 3600 * 1000;
type Db = typeof prisma;
type Resultado<T = {}> = ({ ok: true } & T) | { error: string; status: number };

const SELECT_MOV = { id: true, tipo: true, fecha: true, minutos: true, minutosTrabajados: true, recargo: true, estado: true, anulado: true, createdAt: true } as const;

// El acuerdo que manda para el saldo (el plazo de vencimiento): el vigente,
// o si no hay, el último.
const acuerdoActual = <A extends AcuerdoMin & { createdAt: Date }>(acs: A[], hoy: Date) =>
  acs.find((a) => estadoAcuerdo(a, hoy) === "vigente") ?? [...acs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;

export function cuentaDe<A extends AcuerdoMin & { createdAt: Date }>(movs: MovMin[], acuerdos: A[], hoy: Date) {
  const ac = acuerdoActual(acuerdos, hoy);
  const r = lotes(movs, ac?.plazoDias ?? null, hoy);
  const reservado = minutosReservados(movs);
  return { ...r, reservado, disponible: r.saldo - reservado, acuerdo: ac, estadoAcuerdo: ac ? estadoAcuerdo(ac, hoy) : null };
}

// Todas las personas activas (el alcance ya deja solo las del sector del
// usuario) con su acuerdo y su saldo.
export async function estadoBanco(empresaId: string, hoy: Date) {
  const legajos = await prisma.legajo.findMany({
    where: { empresaId, condicion: "activo" },
    select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  });
  const ids = legajos.map((l) => l.id);
  const [acuerdos, movs, egresos] = await Promise.all([
    prisma.acuerdoBancoHoras.findMany({ where: { legajoId: { in: ids } }, orderBy: { createdAt: "desc" } }),
    prisma.movimientoBancoHoras.findMany({ where: { legajoId: { in: ids } }, select: { ...SELECT_MOV, legajoId: true, motivo: true } }),
    prisma.egreso.findMany({ where: { legajoId: { in: ids }, estado: "en_curso" }, select: { legajoId: true, fechaEgreso: true } }),
  ]);
  const personas = legajos.map((l) => {
    const acs = acuerdos.filter((a) => a.legajoId === l.id);
    const ms = movs.filter((m) => m.legajoId === l.id);
    const c = cuentaDe(ms, acs, hoy);
    const egreso = egresos.find((e) => e.legajoId === l.id);
    return {
      id: l.id, legajo: l.numeroLegajo, nombre: `${l.apellido}, ${l.nombre}`, sector: l.centroCosto?.nombre ?? "Sin asignar",
      acuerdo: c.acuerdo ? { id: c.acuerdo.id, estado: c.estadoAcuerdo!, desde: c.acuerdo.desde, hasta: c.acuerdo.hasta, topeHoras: c.acuerdo.topeHoras, plazoDias: c.acuerdo.plazoDias, equivalencia: c.acuerdo.equivalencia, origen: c.acuerdo.origen, aceptadoEn: c.acuerdo.aceptadoEn, enPapel: c.acuerdo.enPapel } : null,
      saldo: c.saldo, disponible: c.disponible, porVencer: c.porVencer, vencido: c.vencido,
      pendientes: ms.filter((m) => m.estado === "pendiente" && !m.anulado).length,
      egreso: egreso ? egreso.fechaEgreso : null,
      movimientos: ms.filter((m) => !m.anulado && m.estado === "aprobado").length,
    };
  });
  const conAcuerdo = personas.filter((p) => p.acuerdo && p.acuerdo.estado !== "terminado");
  const resumen = {
    personas: personas.length,
    vigentes: personas.filter((p) => p.acuerdo?.estado === "vigente").length,
    sinFirmar: personas.filter((p) => p.acuerdo?.estado === "sin_firmar").length,
    saldo: personas.reduce((a, p) => a + Math.max(0, p.saldo), 0),
    porVencer: personas.reduce((a, p) => a + p.porVencer, 0),
    vencido: personas.reduce((a, p) => a + p.vencido, 0),
    pendientes: personas.reduce((a, p) => a + p.pendientes, 0),
    egresoConSaldo: personas.filter((p) => p.egreso && p.saldo > 0).length,
    conAcuerdo: conAcuerdo.length,
  };
  const nombres = new Map(personas.map((p) => [p.id, p]));
  const pedidos = movs.filter((m) => m.estado === "pendiente" && !m.anulado).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => ({ id: m.id, legajoId: m.legajoId, nombre: nombres.get(m.legajoId)?.nombre ?? "", sector: nombres.get(m.legajoId)?.sector ?? "", tipo: m.tipo, fecha: m.fecha, minutos: -m.minutos, motivo: m.motivo, pedidoEn: m.createdAt, saldo: nombres.get(m.legajoId)?.saldo ?? 0 }));
  return { personas, resumen, pedidos };
}

// El detalle de una persona: acuerdos, movimientos y lotes.
export async function detalleBanco(legajoId: string, empresaId: string, hoy: Date) {
  const l = await prisma.legajo.findFirst({ where: { id: legajoId, empresaId }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true } });
  if (!l) return null;
  const [acuerdos, movs] = await Promise.all([
    prisma.acuerdoBancoHoras.findMany({ where: { legajoId }, orderBy: { createdAt: "desc" } }),
    prisma.movimientoBancoHoras.findMany({ where: { legajoId }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 500 }),
  ]);
  const c = cuentaDe(movs, acuerdos, hoy);
  return { persona: { id: l.id, legajo: l.numeroLegajo, nombre: `${l.apellido}, ${l.nombre}` }, acuerdos: acuerdos.map((a) => ({ ...a, estado: estadoAcuerdo(a, hoy) })), movimientos: movs, lotes: c.lotes.filter((x) => x.restante > 0), saldo: c.saldo, disponible: c.disponible, porVencer: c.porVencer, vencido: c.vencido };
}

// ── Acuerdos ─────────────────────────────────────────────────────────────

export async function crearAcuerdos(empresaId: string, legajoIds: string[], datos: { desde: Date; hasta: Date | null; origen: string; topeHoras: number | null; plazoDias: number | null; equivalencia: string; observaciones: string | null }, creadoPor: string, hoy: Date): Promise<Resultado<{ creados: number; ids: string[]; saltados: number }>> {
  if (legajoIds.length === 0) return { error: "Elegí al menos una persona.", status: 400 };
  if (legajoIds.length > 500) return { error: "Son demasiadas personas de una vez.", status: 400 };
  const legajos = await prisma.legajo.findMany({ where: { id: { in: legajoIds }, empresaId, condicion: "activo" }, select: { id: true } });
  if (legajos.length !== new Set(legajoIds).size) return { error: "Alguna persona ya no está activa o no es de tu alcance. Recargá la página.", status: 400 };
  // Quien ya tiene uno sin terminar no recibe otro encima: primero se termina el anterior.
  const abiertos = await prisma.acuerdoBancoHoras.findMany({ where: { legajoId: { in: legajoIds } } });
  const ocupados = new Set(abiertos.filter((a) => estadoAcuerdo(a, hoy) !== "terminado").map((a) => a.legajoId));
  const libres = legajos.filter((l) => !ocupados.has(l.id));
  const ids: string[] = [];
  for (const l of libres) ids.push((await prisma.acuerdoBancoHoras.create({ data: { legajoId: l.id, ...datos, creadoPor }, select: { id: true } })).id);
  return { ok: true, creados: ids.length, ids: libres.map((l) => l.id), saltados: legajos.length - libres.length };
}

// ── Movimientos ──────────────────────────────────────────────────────────

async function cuentaDeLegajo(db: Db, legajoId: string, hoy: Date) {
  const [acuerdos, movs] = await Promise.all([
    db.acuerdoBancoHoras.findMany({ where: { legajoId } }),
    db.movimientoBancoHoras.findMany({ where: { legajoId }, select: SELECT_MOV }),
  ]);
  return { acuerdos, cuenta: cuentaDe(movs, acuerdos, hoy) };
}

// Antes de acreditar: que haya acuerdo ese día y que no pase el tope.
function puedeAcreditar(acuerdos: (AcuerdoMin & { createdAt: Date })[], saldo: number, fecha: Date, minutosTrabajados: number, recargo: number): { acuerdoId: string; minutos: number } | { error: string } {
  const ac = acuerdoDelDia(acuerdos, fecha);
  if (!ac) return { error: `No hay un acuerdo de banco de horas firmado que cubra el ${fecha.toISOString().slice(8, 10)}/${fecha.toISOString().slice(5, 7)}: esas horas se pagan.` };
  const minutos = descansoQueGenera(minutosTrabajados, recargo, ac.equivalencia);
  if (ac.topeHoras && saldo + minutos > ac.topeHoras * 60) return { error: `Pasaría el tope del acuerdo (${ac.topeHoras} h; hoy tiene ${textoHoras(saldo)}): esas horas se pagan o primero se compensan otras.` };
  return { acuerdoId: ac.id, minutos };
}

export async function registrarMovimiento(empresaId: string, legajoId: string, datos: { tipo: string; fecha: Date; minutos: number; minutosTrabajados: number | null; recargo: number | null; motivo: string | null }, cargadoPor: string, hoy: Date): Promise<Resultado> {
  const l = await prisma.legajo.findFirst({ where: { id: legajoId, empresaId }, select: { id: true } });
  if (!l) return { error: "No se encontró esa persona.", status: 404 };
  const { acuerdos, cuenta } = await cuentaDeLegajo(prisma, legajoId, hoy);
  let acuerdoId: string | null = cuenta.acuerdo?.id ?? null, minutos = datos.minutos;
  if (datos.tipo === "acreditacion") {
    const p = puedeAcreditar(acuerdos, cuenta.saldo, datos.fecha, datos.minutosTrabajados!, datos.recargo!);
    if ("error" in p) return { error: p.error, status: 400 };
    acuerdoId = p.acuerdoId; minutos = p.minutos;
  }
  await prisma.movimientoBancoHoras.create({ data: { legajoId, acuerdoId, tipo: datos.tipo, fecha: datos.fecha, minutos, minutosTrabajados: datos.minutosTrabajados, recargo: datos.recargo, motivo: datos.motivo, origen: "manual", cargadoPor } });
  return { ok: true };
}

// Los períodos de liquidación donde todavía se puede cargar una novedad.
export const periodosAbiertos = (empresaId: string) =>
  prisma.periodo.findMany({ where: { empresaId, estado: { not: "cerrada" } }, select: { id: true, nombre: true, fechaDesde: true, fechaHasta: true, convenioId: true }, orderBy: { fechaDesde: "desc" }, take: 12 });

// Carga las horas extra a pagar como novedades del período (HS_EXTRA_50 y
// HS_EXTRA_100, en horas). Devuelve el id de la primera, para enlazar.
async function cargarNovedades(empresaId: string, legajoId: string, periodoId: string, m50: number, m100: number): Promise<{ ids: string[] } | { error: string; status: number }> {
  const [periodo, legajo, conceptos] = await Promise.all([
    prisma.periodo.findFirst({ where: { id: periodoId, empresaId } }),
    prisma.legajo.findFirst({ where: { id: legajoId, empresaId }, select: { convenioId: true } }),
    prisma.concepto.findMany({ where: { codigo: { in: ["HS_EXTRA_50", "HS_EXTRA_100"] } }, select: { id: true, codigo: true } }),
  ]);
  if (!periodo || periodo.estado === "cerrada") return { error: "Elegí un período de liquidación abierto.", status: 400 };
  if (!legajo) return { error: "No se encontró esa persona.", status: 404 };
  if (periodo.convenioId && periodo.convenioId !== legajo.convenioId) return { error: `El período "${periodo.nombre}" es de otro convenio: elegí el que corresponde a esta persona.`, status: 400 };
  const ids: string[] = [];
  for (const [codigo, min] of [["HS_EXTRA_50", m50], ["HS_EXTRA_100", m100]] as const) {
    if (min <= 0) continue;
    const c = conceptos.find((x) => x.codigo === codigo);
    if (!c) return { error: `No está el concepto ${codigo} en el catálogo: no se puede pasar a liquidación.`, status: 400 };
    ids.push((await prisma.novedad.create({ data: { empresaId, legajoId, periodo: periodo.fechaDesde, conceptoId: c.id, cantidad: horasDecimales(min), estado: "valida" }, select: { id: true } })).id);
  }
  return { ids };
}

// Pagar horas del banco: salen de las más viejas, vuelven a horas extra con
// su recargo, y se cargan como novedad en el período elegido.
export async function pagarDelBanco(empresaId: string, legajoId: string, minutos: number, periodoId: string, cargadoPor: string, hoy: Date, pedidoId?: string): Promise<Resultado<{ m50: number; m100: number }>> {
  const { cuenta } = await cuentaDeLegajo(prisma, legajoId, hoy);
  const reservaPropia = pedidoId ? minutos : 0; // si es un pedido, ya está reservado
  if (minutos > cuenta.disponible + reservaPropia) return { error: `Tiene ${textoHoras(Math.max(0, cuenta.disponible + reservaPropia))} disponibles.`, status: 400 };
  const { m50, m100 } = horasAPagar(cuenta.lotes, minutos);
  const nov = await cargarNovedades(empresaId, legajoId, periodoId, m50, m100);
  if ("error" in nov) return nov;
  const datos = { tipo: "pago", fecha: hoy, minutos: -minutos, novedadId: nov.ids.join(",") || null, estado: "aprobado", resueltoPor: cargadoPor, resueltoEn: new Date() };
  if (pedidoId) await prisma.movimientoBancoHoras.update({ where: { id: pedidoId }, data: datos });
  else await prisma.movimientoBancoHoras.create({ data: { legajoId, acuerdoId: cuenta.acuerdo?.id ?? null, ...datos, origen: "manual", cargadoPor } });
  return { ok: true, m50, m100 };
}

// Anular un movimiento: nunca se borra. Si era un pago, se saca la novedad
// (solo si todavía no se liquidó).
export async function anularMovimiento(empresaId: string, id: string, motivo: string): Promise<Resultado> {
  const m = await prisma.movimientoBancoHoras.findFirst({ where: { id, legajo: { empresaId } } });
  if (!m) return { error: "No se encontró ese movimiento.", status: 404 };
  if (m.anulado) return { error: "Ya estaba anulado.", status: 409 };
  if (m.novedadId) {
    const ids = m.novedadId.split(",");
    const usadas = await prisma.liquidacionNovedad.count({ where: { novedadId: { in: ids } } });
    if (usadas) return { error: "Ese pago ya entró en una liquidación: corregilo desde la liquidación y después anulalo acá.", status: 409 };
    await prisma.novedad.deleteMany({ where: { id: { in: ids } } });
  }
  if (m.tipo === "acreditacion") {
    // Que al sacarla no quede en negativo lo que ya se usó.
    const { cuenta } = await cuentaDeLegajo(prisma, m.legajoId, new Date());
    if (m.estado === "aprobado" && cuenta.saldo - m.minutos < 0) return { error: "Esas horas ya se usaron: anulá primero el descanso o el pago que las consumió.", status: 409 };
  }
  await prisma.movimientoBancoHoras.update({ where: { id }, data: { anulado: true, motivoAnulacion: motivo } });
  return { ok: true };
}

// ── Pedidos del portal ───────────────────────────────────────────────────

export async function resolverPedido(empresaId: string, id: string, aprobar: boolean, periodoId: string | null, resueltoPor: string, hoy: Date, motivo: string | null): Promise<Resultado<{ legajoId: string; tipo: string }>> {
  const m = await prisma.movimientoBancoHoras.findFirst({ where: { id, legajo: { empresaId }, estado: "pendiente", anulado: false } });
  if (!m) return { error: "Ese pedido ya se resolvió.", status: 409 };
  if (!aprobar) {
    await prisma.movimientoBancoHoras.update({ where: { id }, data: { estado: "rechazado", resueltoPor, resueltoEn: new Date(), motivoAnulacion: motivo } });
    return { ok: true, legajoId: m.legajoId, tipo: m.tipo };
  }
  if (m.tipo === "pago") {
    if (!periodoId) return { error: "Elegí en qué período se pagan.", status: 400 };
    const r = await pagarDelBanco(empresaId, m.legajoId, -m.minutos, periodoId, resueltoPor, hoy, m.id);
    if ("error" in r) return r;
    return { ok: true, legajoId: m.legajoId, tipo: m.tipo };
  }
  const { cuenta } = await cuentaDeLegajo(prisma, m.legajoId, hoy);
  if (-m.minutos > cuenta.disponible - m.minutos) return { error: "Ya no le alcanza el saldo para ese descanso.", status: 409 };
  await prisma.movimientoBancoHoras.update({ where: { id }, data: { estado: "aprobado", resueltoPor, resueltoEn: new Date() } });
  return { ok: true, legajoId: m.legajoId, tipo: m.tipo };
}

// ── Detectar horas extra desde la asistencia ─────────────────────────────

// Recorre la asistencia ya clasificada de un rango y propone, día por día,
// las horas extra de cada persona. Los días que ya se procesaron (al banco,
// pagados o descartados) no vuelven a aparecer.
export async function detectarHorasExtra(empresaId: string, desde: Date, hasta: Date, hoy: Date) {
  const legajos = await prisma.legajo.findMany({
    where: { empresaId, condicion: "activo" },
    select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } }, asignacionesHorario: { select: { desde: true, hasta: true, horarioIds: true, diaDeCiclo: true } } },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  });
  const ids = legajos.map((l) => l.id);
  const inicioMes = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  const [dias, horarios, exc, acuerdos, hechos] = await Promise.all([
    prisma.asistenciaDia.findMany({ where: { legajoId: { in: ids }, fecha: { gte: new Date(desde.getTime() - DIA_MS), lte: hasta } }, select: { legajoId: true, fecha: true, estado: true, horaIngresoReal: true, horaEgresoReal: true }, orderBy: { fecha: "asc" } }),
    horariosDeEmpresa(empresaId),
    excepcionesEntre(empresaId, new Date(desde.getTime() - DIA_MS), hasta, ids),
    prisma.acuerdoBancoHoras.findMany({ where: { legajoId: { in: ids } } }),
    prisma.movimientoBancoHoras.findMany({ where: { legajoId: { in: ids }, origen: "asistencia", anulado: false, fecha: { gte: inicioMes, lte: hasta } }, select: { legajoId: true, fecha: true, minutosTrabajados: true, tipo: true } }),
  ]);
  const procesado = new Set(hechos.map((h) => `${h.legajoId}|${claveDia(h.fecha)}`));
  let sinHorario = 0;
  const filas = [];
  for (const l of legajos) {
    const propios: DiaConExtra[] = [];
    for (const a of dias.filter((x) => x.legajoId === l.id)) {
      const j = jornadaDelDia(a.fecha, l.asignacionesHorario, horarios, exc.de(l.id));
      const feriado = j.tipo === "feriado";
      const base = feriado ? j.base : j;
      if (base.tipo === "sin_asignar") { if (a.fecha >= desde && a.horaEgresoReal) sinHorario++; continue; }
      const dia = { fecha: a.fecha, feriado, programado: base.tipo === "trabaja" ? { ingreso: base.ingreso, salida: base.salida, nocturno: base.nocturno } : null, ingresoReal: a.horaIngresoReal, egresoReal: a.horaEgresoReal };
      propios.push({ ...dia, ...extraDelDia(dia) });
    }
    // Lo del mes que ya se procesó cuenta para el tope de 30 h.
    const previo = hechos.filter((h) => h.legajoId === l.id && h.fecha < desde && h.tipo !== "descarte").reduce((s, h) => s + (h.minutosTrabajados ?? 0), 0);
    const alertas = alertasDePersona(propios, previo);
    const acs = acuerdos.filter((a) => a.legajoId === l.id);
    for (const d of propios) {
      if (d.fecha < desde || d.m50 + d.m100 === 0 || procesado.has(`${l.id}|${claveDia(d.fecha)}`)) continue;
      const ac = acuerdoDelDia(acs, d.fecha);
      filas.push({
        legajoId: l.id, legajo: l.numeroLegajo, nombre: `${l.apellido}, ${l.nombre}`, sector: l.centroCosto?.nombre ?? "Sin asignar",
        fecha: d.fecha, ingreso: d.ingresoReal, egreso: d.egresoReal, programado: d.programado, feriado: d.feriado,
        m50: d.m50, m100: d.m100, conAcuerdo: !!ac, alertas: alertas.get(claveDia(d.fecha)) ?? [],
      });
    }
  }
  return { filas, sinHorario, sinClasificar: dias.length === 0 };
}

// Lo que RR.HH. decide sobre cada día detectado: al banco, a pagar o
// descartar. Todo o nada por persona: si algo de una persona no se puede
// (falta acuerdo, pasa el tope), esa persona queda sin tocar y se avisa.
export async function confirmarDetectadas(empresaId: string, items: unknown, periodoId: string | null, cargadoPor: string, hoy: Date): Promise<Resultado<{ alBanco: number; pagadas: number; descartadas: number; errores: string[]; personasBanco: string[] }>> {
  const lista = (Array.isArray(items) ? items : []).slice(0, 2000).map((x: any) => ({ legajoId: String(x?.legajoId ?? ""), fecha: new Date(String(x?.fecha ?? "").slice(0, 10) + "T00:00:00Z"), m50: Math.max(0, Math.round(Number(x?.m50) || 0)), m100: Math.max(0, Math.round(Number(x?.m100) || 0)), destino: String(x?.destino ?? "") }));
  if (lista.length === 0) return { error: "No hay nada para confirmar.", status: 400 };
  if (lista.some((x) => isNaN(x.fecha.getTime()) || !["banco", "pagar", "descartar"].includes(x.destino) || x.m50 + x.m100 > 24 * 60)) return { error: "Hay datos que no se entienden. Recargá la página.", status: 400 };
  if (lista.some((x) => x.destino === "pagar") && !periodoId) return { error: "Elegí el período de liquidación donde se pagan las horas.", status: 400 };
  const legajoIds = [...new Set(lista.map((x) => x.legajoId))];
  const legajos = await prisma.legajo.findMany({ where: { id: { in: legajoIds }, empresaId }, select: { id: true, apellido: true, nombre: true } });
  let alBanco = 0, pagadas = 0, descartadas = 0;
  const errores: string[] = [], personasBanco: string[] = [];
  for (const l of legajos) {
    const suyos = lista.filter((x) => x.legajoId === l.id).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const nombre = `${l.apellido}, ${l.nombre}`;
    // Que no se procese dos veces el mismo día (doble clic, dos pestañas).
    const ya = await prisma.movimientoBancoHoras.count({ where: { legajoId: l.id, origen: "asistencia", anulado: false, fecha: { in: suyos.map((s) => s.fecha) } } });
    if (ya) { errores.push(`${nombre}: algún día ya estaba procesado. Volvé a buscar.`); continue; }
    const { acuerdos, cuenta } = await cuentaDeLegajo(prisma, l.id, hoy);
    let saldo = cuenta.saldo;
    const altas: any[] = [];
    let error = "";
    for (const s of suyos) {
      if (s.destino === "banco") {
        for (const [min, recargo] of [[s.m50, 50], [s.m100, 100]] as const) {
          if (!min) continue;
          const p = puedeAcreditar(acuerdos, saldo, s.fecha, min, recargo);
          if ("error" in p) { error = p.error; break; }
          saldo += p.minutos;
          altas.push({ legajoId: l.id, acuerdoId: p.acuerdoId, tipo: "acreditacion", fecha: s.fecha, minutos: p.minutos, minutosTrabajados: min, recargo, origen: "asistencia", cargadoPor });
        }
        if (error) break;
      } else {
        for (const [min, recargo] of [[s.m50, 50], [s.m100, 100]] as const) {
          if (min || s.destino === "descartar") altas.push({ legajoId: l.id, tipo: s.destino === "pagar" ? "pago_directo" : "descarte", fecha: s.fecha, minutos: 0, minutosTrabajados: min, recargo, origen: "asistencia", cargadoPor });
          if (s.destino === "descartar") break; // una marca alcanza
        }
      }
    }
    if (error) { errores.push(`${nombre}: ${error}`); continue; }
    const aPagar = suyos.filter((s) => s.destino === "pagar");
    if (aPagar.length) {
      const nov = await cargarNovedades(empresaId, l.id, periodoId!, aPagar.reduce((a, s) => a + s.m50, 0), aPagar.reduce((a, s) => a + s.m100, 0));
      if ("error" in nov) { errores.push(`${nombre}: ${nov.error}`); continue; }
      for (const a of altas) if (a.tipo === "pago_directo") a.novedadId = nov.ids.join(",");
    }
    await prisma.movimientoBancoHoras.createMany({ data: altas });
    alBanco += suyos.filter((s) => s.destino === "banco").length;
    pagadas += aPagar.length;
    descartadas += suyos.filter((s) => s.destino === "descartar").length;
    if (suyos.some((s) => s.destino === "banco")) personasBanco.push(l.id);
  }
  return { ok: true, alBanco, pagadas, descartadas, errores, personasBanco };
}

// ── Portal ───────────────────────────────────────────────────────────────

export async function bancoDelEmpleado(legajoId: string, hoy: Date) {
  const yo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { condicion: true } });
  if (!yo || yo.condicion !== "activo") return null;
  const [acuerdos, movs] = await Promise.all([
    prisma.acuerdoBancoHoras.findMany({ where: { legajoId }, orderBy: { createdAt: "desc" } }),
    prisma.movimientoBancoHoras.findMany({ where: { legajoId, tipo: { notIn: ["descarte"] } }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 200 }),
  ]);
  if (acuerdos.length === 0 && movs.length === 0) return null;
  const c = cuentaDe(movs, acuerdos, hoy);
  const sinFirmar = acuerdos.filter((a) => estadoAcuerdo(a, hoy) === "sin_firmar");
  return { acuerdos: acuerdos.map((a) => ({ ...a, estado: estadoAcuerdo(a, hoy) })), sinFirmar, movimientos: movs.filter((m) => !m.anulado), saldo: c.saldo, disponible: c.disponible, porVencer: c.porVencer, vencido: c.vencido, lotes: c.lotes.filter((l) => l.restante > 0), vigente: c.estadoAcuerdo === "vigente" };
}
export const acuerdosSinFirmar = (legajoId: string) => prisma.acuerdoBancoHoras.count({ where: { legajoId, aceptadoEn: null, enPapel: false, finalizadoEn: null } });

export async function pedirDesdePortal(legajoId: string, datos: { tipo: "compensacion" | "pago"; fecha: Date; minutos: number; motivo: string | null }, hoy: Date): Promise<Resultado> {
  const { cuenta } = await cuentaDeLegajo(prisma, legajoId, hoy);
  if (cuenta.estadoAcuerdo !== "vigente" && datos.tipo === "compensacion") return { error: "No tenés un acuerdo de banco de horas vigente.", status: 400 };
  if (datos.minutos > cuenta.disponible) return { error: `Tenés ${textoHoras(Math.max(0, cuenta.disponible))} disponibles.`, status: 400 };
  await prisma.movimientoBancoHoras.create({ data: { legajoId, acuerdoId: cuenta.acuerdo?.id ?? null, tipo: datos.tipo, fecha: datos.fecha, minutos: -datos.minutos, estado: "pendiente", origen: "portal", motivo: datos.motivo } });
  return { ok: true };
}

// El PDF de un acuerdo. `legajoId`: si viene del portal, solo el propio.
export async function pdfDeAcuerdo(acuerdoId: string, filtro: { empresaId?: string; legajoId?: string }) {
  const { generarAcuerdoBancoHorasPDF } = await import("./banco-horas-pdf");
  const a = await prisma.acuerdoBancoHoras.findFirst({
    where: { id: acuerdoId, ...(filtro.legajoId ? { legajoId: filtro.legajoId } : {}), ...(filtro.empresaId ? { legajo: { empresaId: filtro.empresaId } } : {}) },
    include: { legajo: { select: { numeroLegajo: true, apellido: true, nombre: true, cuil: true, empresaId: true, puesto: { select: { nombre: true } } } } },
  });
  if (!a) return null;
  const e = await prisma.empresa.findUnique({ where: { id: a.legajo.empresaId }, select: { razonSocial: true, cuit: true, domicilio: true } });
  const cuil = a.legajo.cuil.replace(/\D/g, "");
  const pdf = await generarAcuerdoBancoHorasPDF({
    empresa: e!.razonSocial, cuit: e!.cuit, domicilio: e!.domicilio,
    trabajador: `${a.legajo.apellido}, ${a.legajo.nombre}`, cuil: cuil.length === 11 ? `${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}` : a.legajo.cuil, legajo: a.legajo.numeroLegajo, puesto: a.legajo.puesto?.nombre ?? null,
    desde: a.desde, hasta: a.hasta, origen: a.origen, topeHoras: a.topeHoras, plazoDias: a.plazoDias, equivalencia: a.equivalencia, observaciones: a.observaciones,
    aceptadoEn: a.aceptadoEn, aceptadoIp: a.aceptadoIp, finalizadoEn: a.finalizadoEn,
  });
  return { pdf, nombre: `Acuerdo_banco_horas_${a.legajo.apellido.replace(/[^\w]+/g, "_")}_${a.legajo.numeroLegajo}.pdf` };
}
