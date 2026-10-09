// FM RRHH — lib/ausencias.ts
// Lado base de datos de los pedidos de vacaciones/permisos. Lo usan el
// portal (empleado) y /solicitudes (RR.HH.) — un solo lugar para "cuánto
// saldo tiene" y "qué fechas ya tiene tomadas", así las dos puntas nunca
// calculan distinto.
import { prisma } from "./prisma";
import { calcularSaldo, type SaldoVacaciones } from "./ausencias-reglas";
export * from "./ausencias-reglas";

const fechaCorta = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export async function saldoVacaciones(legajoId: string, anio: number, excluirSolicitudId?: string): Promise<SaldoVacaciones> {
  const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: legajoId }, select: { fechaIngreso: true, antiguedadReconocida: true } });
  const [vacaciones, pendientes] = await Promise.all([
    prisma.vacacion.findMany({ where: { legajoId, anioCorresponde: anio }, select: { diasCorresponden: true } }),
    prisma.solicitudAusencia.findMany({
      where: { legajoId, tipo: "vacaciones", estado: "pendiente", fechaDesde: { gte: new Date(Date.UTC(anio, 0, 1)), lte: new Date(Date.UTC(anio, 11, 31)) }, NOT: excluirSolicitudId ? { id: excluirSolicitudId } : undefined },
      select: { dias: true },
    }),
  ]);
  return calcularSaldo(legajo, anio, vacaciones.reduce((a, v) => a + v.diasCorresponden, 0), pendientes.reduce((a, s) => a + s.dias, 0));
}

// Todo lo que el empleado ya tiene en ese rango: pedidos pendientes o
// aprobados, y vacaciones registradas (vengan del portal o cargadas por
// RR.HH. en /vacaciones).
export async function rangosOcupados(legajoId: string, desde: Date, hasta: Date, excluirSolicitudId?: string) {
  const [solicitudes, vacaciones] = await Promise.all([
    prisma.solicitudAusencia.findMany({
      where: { legajoId, estado: { in: ["pendiente", "aprobada"] }, fechaDesde: { lte: hasta }, fechaHasta: { gte: desde }, NOT: excluirSolicitudId ? { id: excluirSolicitudId } : undefined },
    }),
    prisma.vacacion.findMany({ where: { legajoId, fechaDesde: { lte: hasta }, fechaHasta: { gte: desde }, solicitud: excluirSolicitudId ? { isNot: { id: excluirSolicitudId } } : undefined } }),
  ]);
  return [
    ...solicitudes.map((s) => ({
      desde: s.fechaDesde, hasta: s.fechaHasta,
      descripcion: `${s.estado === "pendiente" ? "un pedido que todavía está sin responder" : s.tipo === "permiso" ? "un permiso aprobado" : "vacaciones aprobadas"} (${fechaCorta(s.fechaDesde)} al ${fechaCorta(s.fechaHasta)})`,
    })),
    ...vacaciones.map((v) => ({ desde: v.fechaDesde, hasta: v.fechaHasta, descripcion: `vacaciones ya registradas (${fechaCorta(v.fechaDesde)} al ${fechaCorta(v.fechaHasta)})` })),
  ];
}
