// FM RRHH — lib/encuestas.ts
// Lado base de datos de las encuestas de clima.
import { prisma, prismaSistema } from "./prisma";
export * from "./encuestas-reglas";

// Una encuesta abierta cuyo último día ya pasó se cierra sola. Se llama al
// abrir cualquier pantalla de encuestas y desde la tarea diaria. Sin el
// filtro de alcance: es una tarea del sistema, no de quien mira.
export async function cerrarVencidas(hoy: Date, empresaId?: string) {
  await prismaSistema.encuesta.updateMany({ where: { estado: "abierta", fechaCierre: { lt: hoy }, ...(empresaId ? { empresaId } : {}) }, data: { estado: "cerrada", cerradaEn: new Date() } });
}

// A quiénes les corresponde: activos de la empresa, de los sectores
// elegidos (o todos).
export const filtroDestinatarios = (e: { empresaId: string; centroCostoIds: string[] }) => ({ empresaId: e.empresaId, condicion: "activo", ...(e.centroCostoIds.length ? { centroCostoId: { in: e.centroCostoIds } } : {}) });

// Las encuestas abiertas que una persona todavía no respondió.
export async function encuestasPendientesDe(legajoId: string) {
  const legajo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true, condicion: true } });
  if (!legajo || legajo.condicion !== "activo") return [];
  const abiertas = await prisma.encuesta.findMany({ where: { empresaId: legajo.empresaId, estado: "abierta", participaciones: { none: { legajoId } } }, orderBy: { fechaCierre: "asc" } });
  return abiertas.filter((e) => e.centroCostoIds.length === 0 || (legajo.centroCostoId !== null && e.centroCostoIds.includes(legajo.centroCostoId)));
}
