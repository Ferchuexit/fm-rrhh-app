// FM RRHH — lib/portal.ts
// Lado Node del portal del empleado (Route Handlers y Server Components).
// Para el middleware, usar lib/portal-edge.ts directo.
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "./prisma";
import { armarDatosRecibo } from "./armar-recibo";
import { NOMBRE_COOKIE_PORTAL, HORAS_SESION_PORTAL, verificarSesionPortal, firmarSesionPortal, type SesionPortal } from "./portal-edge";
export * from "./portal-edge";
export * from "./portal-pin";

// Un recibo aparece en el portal recién cuando el período está CERRADO:
// mientras está en borrador/validado, RR.HH. todavía puede estar
// corrigiendo, y el empleado no tiene que ver (ni firmar) números que van
// a cambiar. Si el período se reabre, sus recibos dejan de verse hasta que
// se vuelva a cerrar.
export const ESTADOS_PERIODO_PUBLICADOS = ["cerrada"];

// Además de verificar la firma del token, confirma en la base que el
// acceso SIGA activo: si RR.HH. lo desactiva, la sesión que el empleado ya
// tenía abierta deja de servir en el momento, no recién cuando vence.
// (El middleware no puede hacer esto — corre en Edge, sin Prisma.)
// `cache` = una sola consulta por pedido aunque la llamen layout y página.
export const obtenerSesionPortal = cache(async (): Promise<SesionPortal | null> => {
  const token = cookies().get(NOMBRE_COOKIE_PORTAL)?.value;
  if (!token) return null;
  const sesion = await verificarSesionPortal(token);
  if (!sesion) return null;
  const acceso = await prisma.accesoPortal.findUnique({ where: { legajoId: sesion.legajoId }, select: { activo: true } });
  return acceso?.activo ? sesion : null;
});

export async function cookieSesionPortal(sesion: SesionPortal) {
  return {
    name: NOMBRE_COOKIE_PORTAL,
    value: await firmarSesionPortal(sesion),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * HORAS_SESION_PORTAL,
  };
}

export function ipDelPedido(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

// El recibo SOLO si es de este legajo, es la versión vigente y su período
// está publicado. Toda ruta del portal que reciba un id de liquidación
// pasa por acá — es el único lugar donde se decide "¿este recibo es tuyo?".
export async function liquidacionDelEmpleado(liquidacionId: string, legajoId: string) {
  return prisma.liquidacion.findFirst({
    where: { id: liquidacionId, legajoId, vigente: true, periodo: { estado: { in: ESTADOS_PERIODO_PUBLICADOS } } },
    include: { periodo: true, reciboDigital: true },
  });
}

export async function recibosDelEmpleado(legajoId: string) {
  return prisma.liquidacion.findMany({
    where: { legajoId, vigente: true, periodo: { estado: { in: ESTADOS_PERIODO_PUBLICADOS } } },
    include: { periodo: true, reciboDigital: true },
    orderBy: { periodo: { fechaHasta: "desc" } },
  });
}

// Deja constancia de la primera vez que el empleado abrió el recibo.
export async function registrarVista(liquidacionId: string, legajoId: string) {
  await prisma.reciboDigital.upsert({
    where: { liquidacionId },
    create: { liquidacionId, legajoId, primeraVistaEn: new Date() },
    update: {},
  });
  await prisma.reciboDigital.updateMany({ where: { liquidacionId, primeraVistaEn: null }, data: { primeraVistaEn: new Date() } });
}

// Huella del CONTENIDO del recibo (no del PDF: pdf-lib le pone fecha de
// creación a cada archivo, así que dos PDF del mismo recibo nunca dan el
// mismo hash). Se guarda al firmar: si después alguien cambia un importe,
// recalcular esto da otro valor y queda en evidencia que lo firmado no es
// lo que hay ahora.
export async function hashContenidoRecibo(liquidacionId: string, version: number, legajoId: string, periodoId: string): Promise<string | null> {
  const datos = await armarDatosRecibo(legajoId, periodoId);
  if (!datos) return null;
  return createHash("sha256").update(JSON.stringify({ liquidacionId, version, datos })).digest("hex");
}

// Para las dos rutas que BORRAN liquidaciones (DELETE /api/liquidar y el
// borrado forzado de un concepto). Un recibo firmado no se borra nunca en
// silencio: devuelve el mensaje de error para mostrar. Si solo fue visto
// (sin firma), se limpia esa constancia para que el borrado pueda seguir.
export async function liberarRecibosDigitales(liquidacionIds: string[]): Promise<string | null> {
  if (liquidacionIds.length === 0) return null;
  const firmados = await prisma.reciboDigital.count({ where: { liquidacionId: { in: liquidacionIds }, firma: { not: null } } });
  if (firmados > 0) {
    return `No se puede eliminar: ${firmados} de estas liquidaciones ya ${firmados === 1 ? "tiene su recibo firmado" : "tienen su recibo firmado"} por el empleado en el portal. Para corregir, volvé a liquidar el período (se genera una versión nueva y la firmada queda como antecedente).`;
  }
  await prisma.reciboDigital.deleteMany({ where: { liquidacionId: { in: liquidacionIds } } });
  return null;
}
