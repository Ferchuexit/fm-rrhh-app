// FM RRHH — lib/reclamos.ts
// Lado base de datos de los reclamos de haberes (reglas en lib/reclamos-reglas.ts).
import { prisma } from "./prisma";
import { ESTADOS_PERIODO_PUBLICADOS } from "./portal";
import { motivosDe, validarReclamo, validarResolucion, type ItemReclamo } from "./reclamos-reglas";
export * from "./reclamos-reglas";

const MAX_PENDIENTES = 5;
type Resultado<T = {}> = ({ ok: true } & T) | { error: string; status: number };

export async function motivosDeEmpresa(empresaId: string) {
  const e = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { motivosReclamo: true } });
  return { motivos: motivosDe(e?.motivosReclamo), propios: Array.isArray(e?.motivosReclamo) && (e!.motivosReclamo as unknown[]).length > 0 };
}

// ── Portal ───────────────────────────────────────────────────────────────

export async function reclamosDelEmpleado(legajoId: string) {
  return prisma.reclamoHaberes.findMany({ where: { legajoId }, orderBy: { createdAt: "desc" }, take: 50 });
}

// Lo que puede elegir al reclamar: sus recibos publicados (los últimos dos
// años, el plazo para reclamar créditos laborales — art. 256 LCT).
export async function recibosParaReclamar(legajoId: string) {
  const desde = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000);
  return prisma.liquidacion.findMany({
    where: { legajoId, vigente: true, periodo: { estado: { in: ESTADOS_PERIODO_PUBLICADOS }, fechaHasta: { gte: desde } } },
    select: { id: true, periodo: { select: { nombre: true } } },
    orderBy: { periodo: { fechaHasta: "desc" } },
  });
}

export async function crearReclamo(legajoId: string, empresaId: string, body: any): Promise<Resultado<{ id: string }>> {
  const { motivos } = await motivosDeEmpresa(empresaId);
  const { datos, error } = validarReclamo(body, motivos);
  if (!datos) return { error: error!, status: 400 };
  let liquidacionId: string | null = null, periodoNombre: string | null = null;
  if (body?.liquidacionId) {
    const recibos = await recibosParaReclamar(legajoId);
    const r = recibos.find((x) => x.id === String(body.liquidacionId));
    if (!r) return { error: "Ese recibo no está disponible para reclamar.", status: 400 };
    liquidacionId = r.id; periodoNombre = r.periodo.nombre;
  }
  const pendientes = await prisma.reclamoHaberes.count({ where: { legajoId, estado: "pendiente" } });
  if (pendientes >= MAX_PENDIENTES) return { error: `Ya tenés ${pendientes} reclamos esperando respuesta. Esperá que RR.HH. los conteste, o sumá esto al chat.`, status: 409 };
  const r = await prisma.reclamoHaberes.create({ data: { legajoId, liquidacionId, periodoNombre, items: datos.items as any, comentario: datos.comentario }, select: { id: true } });
  return { ok: true, id: r.id };
}

export const respuestasSinVer = (legajoId: string) => prisma.reclamoHaberes.count({ where: { legajoId, estado: { not: "pendiente" }, vistoEn: null } });

// ── Panel de RR.HH. ──────────────────────────────────────────────────────

export async function bandejaReclamos(empresaId: string) {
  const reclamos = await prisma.reclamoHaberes.findMany({
    where: { legajo: { empresaId } },
    include: { legajo: { select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return reclamos.map((r) => ({
    id: r.id, legajoId: r.legajoId, legajo: r.legajo.numeroLegajo, nombre: `${r.legajo.apellido}, ${r.legajo.nombre}`, sector: r.legajo.centroCosto?.nombre ?? "Sin asignar",
    periodoNombre: r.periodoNombre, items: r.items as unknown as ItemReclamo[], comentario: r.comentario, estado: r.estado, respuesta: r.respuesta, periodoAjuste: r.periodoAjuste,
    novedades: r.novedadIds.length, resueltoPor: r.resueltoPor, resueltoEn: r.resueltoEn, createdAt: r.createdAt, liquidacionId: r.liquidacionId,
  }));
}

// Para resolver: lo que dice el recibo reclamado, los conceptos del
// catálogo y los períodos abiertos donde cargar el ajuste.
export async function contextoReclamo(id: string, empresaId: string) {
  const r = await prisma.reclamoHaberes.findFirst({ where: { id, legajo: { empresaId } }, include: { legajo: { select: { convenioId: true } } } });
  if (!r) return null;
  const [liq, conceptos, periodos] = await Promise.all([
    r.liquidacionId ? prisma.liquidacion.findUnique({ where: { id: r.liquidacionId }, select: { periodoId: true, legajoId: true, bruto: true, neto: true, detalle: { where: { excluido: false }, select: { importe: true, concepto: { select: { codigo: true, nombre: true, tipo: true } } } } } }) : null,
    prisma.concepto.findMany({ where: { tipo: { not: "contribucion_patronal" } }, select: { codigo: true, nombre: true, unidad: true }, orderBy: { nombre: "asc" } }),
    prisma.periodo.findMany({ where: { empresaId, estado: { not: "cerrada" } }, select: { id: true, nombre: true, convenioId: true }, orderBy: { fechaDesde: "desc" }, take: 12 }),
  ]);
  return {
    recibo: liq && liq.legajoId === r.legajoId ? { periodoId: liq.periodoId, bruto: Number(liq.bruto), neto: Number(liq.neto), lineas: liq.detalle.filter((d) => d.concepto.tipo !== "contribucion_patronal").map((d) => ({ codigo: d.concepto.codigo, nombre: d.concepto.nombre, tipo: d.concepto.tipo, importe: Number(d.importe) })) } : null,
    conceptos,
    periodos: periodos.filter((p) => !p.convenioId || p.convenioId === r.legajo.convenioId),
  };
}

export async function resolverReclamo(id: string, empresaId: string, body: any, resueltoPor: string): Promise<Resultado<{ legajoId: string; estado: string }>> {
  const r = await prisma.reclamoHaberes.findFirst({ where: { id, legajo: { empresaId } }, include: { legajo: { select: { convenioId: true } } } });
  if (!r) return { error: "No se encontró ese reclamo.", status: 404 };
  if (r.estado !== "pendiente") return { error: "Ese reclamo ya se respondió.", status: 409 };
  const conceptos = await prisma.concepto.findMany({ select: { id: true, codigo: true, unidad: true } });
  const { datos, error } = validarResolucion(body, r.items as unknown as ItemReclamo[], conceptos.map((c) => c.codigo));
  if (!datos) return { error: error!, status: 400 };
  let periodo: { id: string; nombre: string; fechaDesde: Date } | null = null;
  if (datos.conNovedad) {
    const p = await prisma.periodo.findFirst({ where: { id: String(body?.periodoId ?? ""), empresaId } });
    if (!p || p.estado === "cerrada") return { error: "Elegí un período de liquidación abierto para cargar el ajuste.", status: 400 };
    if (p.convenioId && p.convenioId !== r.legajo.convenioId) return { error: `El período "${p.nombre}" es de otro convenio.`, status: 400 };
    periodo = p;
  }
  const novedadIds: string[] = [];
  for (const it of datos.items) {
    if (!it.aprobado || !it.conceptoCodigo || !periodo) continue;
    const c = conceptos.find((x) => x.codigo === it.conceptoCodigo)!;
    // Concepto en monto: va como valor; en horas o días: como cantidad.
    const enMonto = c.unidad === "monto";
    const n = await prisma.novedad.create({ data: { empresaId, legajoId: r.legajoId, periodo: periodo.fechaDesde, conceptoId: c.id, cantidad: enMonto ? null : it.cantidadAprobada, valor: enMonto ? it.cantidadAprobada : null, estado: "valida" }, select: { id: true } });
    novedadIds.push(n.id);
  }
  // Solo si nadie lo resolvió mientras tanto (dos pestañas).
  const { count } = await prisma.reclamoHaberes.updateMany({ where: { id, estado: "pendiente" }, data: { items: datos.items as any, estado: datos.estado, respuesta: datos.respuesta, periodoAjuste: periodo?.nombre ?? (String(body?.periodoTexto ?? "").trim().slice(0, 60) || null), novedadIds, resueltoPor, resueltoEn: new Date() } });
  if (!count) {
    if (novedadIds.length) await prisma.novedad.deleteMany({ where: { id: { in: novedadIds } } });
    return { error: "Ese reclamo ya se respondió.", status: 409 };
  }
  return { ok: true, legajoId: r.legajoId, estado: datos.estado };
}
