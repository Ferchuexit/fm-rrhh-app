// FM RRHH — lib/epp.ts
// Lado base de datos del EPP y la ropa de trabajo.
import { prisma } from "./prisma";
import { eppDe, resumenEpp, validarEntrega, vencimiento, type EntregaMin } from "./epp-reglas";
import { fechaDesdeTexto } from "./ausencias-reglas";
export * from "./epp-reglas";

// El estado del EPP de toda la empresa: persona por persona, qué le
// corresponde y cómo está cada cosa. (El alcance del usuario ya limita la
// gente a la de sus sectores.) `sectorId`: para el tablero de indicadores.
export async function estadoEpp(empresaId: string, hoy: Date, sectorId: string | null = null) {
  const [elementos, legajos] = await Promise.all([
    prisma.elementoEpp.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } }),
    prisma.legajo.findMany({ where: { empresaId, condicion: "activo", ...(sectorId ? { centroCostoId: sectorId } : {}) }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCostoId: true, puestoId: true, talleRopa: true, talleCalzado: true, centroCosto: { select: { nombre: true } }, puesto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
  ]);
  // Aparte y no anidadas: así respetan el alcance del usuario.
  const entregas = await prisma.entregaEpp.findMany({ where: { legajoId: { in: legajos.map((l) => l.id) }, elementoId: { not: null } }, select: { id: true, legajoId: true, elementoId: true, fechaEntrega: true, vence: true, firmadoEn: true, enPapel: true }, orderBy: { fechaEntrega: "desc" } });
  const min = (e: (typeof entregas)[number]): EntregaMin & { id: string } => ({ id: e.id, elementoId: e.elementoId, fechaEntrega: e.fechaEntrega, vence: e.vence, firmada: !!e.firmadoEn || e.enPapel });
  const activos = elementos.filter((e) => e.activo);
  const personas = legajos.map((l) => ({
    id: l.id, legajo: l.numeroLegajo, nombre: `${l.apellido}, ${l.nombre}`, sector: l.centroCosto?.nombre ?? "Sin asignar", puesto: l.puesto?.nombre ?? null, talleRopa: l.talleRopa, talleCalzado: l.talleCalzado,
    filas: eppDe(l, activos, entregas.filter((e) => e.legajoId === l.id).map(min), hoy),
  }));
  // Qué elemento es el que más falta o está vencido: por dónde empezar a comprar.
  const porElemento = activos.map((e) => { const filas = personas.flatMap((p) => p.filas.filter((f) => f.elementoId === e.id)); return { id: e.id, nombre: e.nombre, corresponde: filas.length, falta: filas.filter((f) => f.estado === "falta").length, vencido: filas.filter((f) => f.estado === "vencido").length, porVencer: filas.filter((f) => f.estado === "por_vencer").length }; }).filter((e) => e.corresponde > 0);
  return { elementos, personas, resumen: resumenEpp(personas), porElemento };
}

// Registra lo que se le entrega a una persona (uno o varios elementos de
// una vez). Guarda cómo era cada elemento ese día.
export async function registrarEntregas(empresaId: string, legajoId: string, items: unknown, fechaTexto: unknown, entregadoPor: string, hoy: Date): Promise<{ error: string; status: number } | { ok: true; cantidad: number }> {
  const lista = Array.isArray(items) ? items : [];
  if (lista.length === 0) return { error: "Marcá al menos un elemento para entregar.", status: 400 };
  if (lista.length > 30) return { error: "Son demasiados elementos de una vez.", status: 400 };
  // prisma.legajo ya filtra por alcance: no se le entrega a alguien de otro sector.
  const legajo = await prisma.legajo.findFirst({ where: { id: legajoId, empresaId, condicion: "activo" }, select: { id: true, talleRopa: true, talleCalzado: true } });
  if (!legajo) return { error: "No se encontró esa persona.", status: 404 };
  const fecha = fechaTexto ? fechaDesdeTexto(fechaTexto as string) : hoy;
  const elementos = await prisma.elementoEpp.findMany({ where: { empresaId } });
  const filas = [];
  for (const it of lista) {
    const { datos, error } = validarEntrega(it, fecha, hoy);
    if (!datos) return { error: error!, status: 400 };
    const e = elementos.find((x) => x.id === datos.elementoId);
    if (!e) return { error: "Uno de los elementos ya no está en el catálogo. Recargá la página.", status: 400 };
    const talle = datos.talle ?? (e.talle === "ropa" ? legajo.talleRopa : e.talle === "calzado" ? legajo.talleCalzado : null);
    filas.push({ legajoId: legajo.id, elementoId: e.id, producto: e.nombre, tipoModelo: e.tipoModelo, marca: e.marca, certificado: e.certificado, cantidad: datos.cantidad, talle, fechaEntrega: datos.fechaEntrega, vence: vencimiento(datos.fechaEntrega, e.vidaUtilDias), motivo: datos.motivo, observacion: datos.observacion, entregadoPor });
  }
  await prisma.entregaEpp.createMany({ data: filas });
  return { ok: true, cantidad: filas.length };
}

// Lo que ve el empleado: lo que le corresponde con su estado, y lo que
// tiene entregado sin firmar.
export async function eppDelEmpleado(legajoId: string, hoy: Date) {
  const yo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true, puestoId: true, condicion: true } });
  if (!yo || yo.condicion !== "activo") return null;
  const [elementos, entregas] = await Promise.all([
    prisma.elementoEpp.findMany({ where: { empresaId: yo.empresaId, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.entregaEpp.findMany({ where: { legajoId }, orderBy: { fechaEntrega: "desc" }, take: 200 }),
  ]);
  const filas = eppDe(yo, elementos, entregas.map((e) => ({ elementoId: e.elementoId, fechaEntrega: e.fechaEntrega, vence: e.vence, firmada: !!e.firmadoEn || e.enPapel })), hoy);
  return { filas: filas.map((f) => ({ ...f, nombre: elementos.find((e) => e.id === f.elementoId)!.nombre })), sinFirmar: entregas.filter((e) => !e.firmadoEn && !e.enPapel), historial: entregas };
}
export const eppSinFirmar = (legajoId: string) => prisma.entregaEpp.count({ where: { legajoId, firmadoEn: null, enPapel: false } });
