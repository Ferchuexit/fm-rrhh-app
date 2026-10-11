// FM RRHH — lib/cultura.ts
// Lado base de datos de cumpleaños, aniversarios y reconocimientos.
import { prisma, prismaSistema } from "./prisma";
import { avisar, avisoReconocimiento } from "./avisos";
import { VALORES_INICIALES, validarReconocimiento, inicioDelMes, celebraciones, type PersonaFechas, type Valor } from "./cultura-reglas";
export * from "./cultura-reglas";

// Los valores de la empresa. La primera vez se crean los de partida (sin el
// filtro de alcance: tienen que existir aunque el primero en abrir el muro
// sea un empleado desde el portal).
export async function valoresDe(empresaId: string): Promise<Valor[]> {
  const filas = await prisma.valorEmpresa.findMany({ where: { empresaId }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  if (filas.length > 0) return filas.map((v) => ({ nombre: v.nombre, emoji: v.emoji }));
  await prismaSistema.valorEmpresa.createMany({ data: VALORES_INICIALES.map((v, orden) => ({ empresaId, ...v, orden })), skipDuplicates: true });
  return VALORES_INICIALES;
}

// Las personas activas de una empresa con sus fechas, para los festejos.
// `db`: el cliente a usar (la tarea diaria usa el del sistema).
export async function personasConFechas(empresaId: string, db: typeof prisma | typeof prismaSistema = prisma): Promise<PersonaFechas[]> {
  const legajos = await (db as typeof prisma).legajo.findMany({ where: { empresaId, condicion: "activo" }, select: { id: true, nombre: true, apellido: true, jefeId: true, fechaNacimiento: true, fechaIngreso: true, ocultarCumple: true, centroCosto: { select: { nombre: true } } } });
  return legajos.map((l) => ({ id: l.id, nombre: l.nombre, apellido: l.apellido, jefeId: l.jefeId, fechaNacimiento: l.fechaNacimiento, fechaIngreso: l.fechaIngreso, ocultarCumple: l.ocultarCumple, sector: l.centroCosto?.nombre ?? null }));
}

export const festejosDeHoy = async (empresaId: string, hoy: Date) => celebraciones(await personasConFechas(empresaId), hoy, 0, true);

// Da un reconocimiento. `emisor`: el empleado que lo da desde el portal, o
// null si lo da RR.HH. desde el panel (ahí `nombreEmisor` es la empresa).
export async function reconocer(empresaId: string, entrada: unknown, emisor: { id: string; nombre: string } | null, nombreEmisor: string, hoy: Date): Promise<{ error: string; status: number } | { ok: true; id: string }> {
  const valores = await valoresDe(empresaId);
  const delMes = emisor ? await prisma.reconocimiento.count({ where: { emisorId: emisor.id, createdAt: { gte: inicioDelMes(hoy) } } }) : null;
  const { datos, error } = validarReconocimiento(entrada, emisor?.id ?? null, valores, delMes);
  if (error) return { error, status: 400 };
  const para = await prisma.legajo.findFirst({ where: { id: datos.paraId, empresaId, condicion: "activo" }, select: { id: true } });
  if (!para) return { error: "Esa persona ya no figura en la empresa. Recargá la página.", status: 400 };
  const creado = await prisma.reconocimiento.create({ data: { legajoId: para.id, emisorId: emisor?.id ?? null, emisorNombre: nombreEmisor.slice(0, 80), valor: datos.valor.nombre, emoji: datos.valor.emoji, mensaje: datos.mensaje } });
  await avisar([para.id], avisoReconocimiento(nombreEmisor, datos.valor.nombre));
  return { ok: true, id: creado.id };
}
