// FM RRHH — lib/periodo-asistencia-lock.ts
// Un solo lugar para la pregunta "¿esta fecha está en un período de
// asistencia ya cerrado?" — la usan PATCH /api/asistencia, POST
// /api/asistencia/clasificar, y prisma/clasificar-asistencia.ts (CLI), así
// que no puede vivir duplicada en cada uno con el riesgo de que se
// desincronicen.
import { prisma } from "@/lib/prisma";

export async function obtenerPeriodosCerrados(empresaId: string) {
  return prisma.periodoAsistencia.findMany({ where: { empresaId, estado: "cerrado" } });
}

export function fechaEstaCerrada(fecha: Date, periodosCerrados: { fechaDesde: Date; fechaHasta: Date; nombre: string }[]) {
  return periodosCerrados.find((p) => p.fechaDesde <= fecha && p.fechaHasta >= fecha) ?? null;
}
