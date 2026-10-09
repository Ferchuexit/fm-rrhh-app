// FM RRHH — lib/portal-edge.ts
// Sesión del PORTAL DEL EMPLEADO. Mismo criterio que lib/auth-edge.ts: lo
// importa middleware.ts (runtime Edge), así que acá solo va `jose` — nada
// de Prisma, bcrypt ni next/headers.
//
// Dos decisiones de seguridad, las dos a propósito:
//
// 1. Cookie propia ("sesion_portal"), no la cookie "sesion" del sistema.
//    Las ~100 rutas de /api que ya existen asumen que quien tiene cookie
//    "sesion" es un operador que puede ver a toda la dotación. Un empleado
//    nunca recibe esa cookie, así que ninguna ruta vieja lo deja pasar —
//    no hace falta revisarlas una por una.
//
// 2. Secreto DERIVADO (AUTH_SECRET + ":portal"), no el mismo. Si los dos
//    tokens se firmaran con la misma clave, alguien podría copiar su token
//    de empleado dentro de la cookie "sesion" y el middleware lo aceptaría
//    como un usuario del sistema. Con claves distintas, cada token solo
//    verifica en su propia puerta.
import { SignJWT, jwtVerify } from "jose";

export const NOMBRE_COOKIE_PORTAL = "sesion_portal";
export const HORAS_SESION_PORTAL = 12;

const secretPortal = new TextEncoder().encode(
  (process.env.AUTH_SECRET || "clave-de-desarrollo-NO-USAR-fuera-de-localhost-cambiar-en-env-local") + ":portal"
);

export interface SesionPortal {
  legajoId: string;
  empresaId: string;
  nombre: string;
  debeCambiarPin: boolean;
}

export async function firmarSesionPortal(s: SesionPortal): Promise<string> {
  return new SignJWT({ empresaId: s.empresaId, nombre: s.nombre, debeCambiarPin: s.debeCambiarPin })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.legajoId)
    .setAudience("portal")
    .setIssuedAt()
    .setExpirationTime(`${HORAS_SESION_PORTAL}h`)
    .sign(secretPortal);
}

export async function verificarSesionPortal(token: string): Promise<SesionPortal | null> {
  try {
    const { payload } = await jwtVerify(token, secretPortal, { audience: "portal" });
    if (!payload.sub || typeof payload.empresaId !== "string") return null;
    return {
      legajoId: payload.sub,
      empresaId: payload.empresaId,
      nombre: (payload.nombre as string) ?? "",
      debeCambiarPin: payload.debeCambiarPin === true,
    };
  } catch {
    return null; // vencido, manipulado, o firmado con otra clave (por ej. un token del sistema)
  }
}
