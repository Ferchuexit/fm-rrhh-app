// FM RRHH — lib/auth-edge.ts
//
// ⚠️ Este archivo lo importa middleware.ts, que corre en el runtime "Edge"
// de Next.js — un entorno reducido que NO soporta Prisma ni módulos de Node
// como `next/headers`. Por eso este archivo solo usa `jose` (que sí es
// compatible con Edge) y no importa nada de lib/auth.ts. Si mezclás algo de
// Node acá, el middleware se rompe al arrancar — no es un error sutil, es
// inmediato y bastante confuso si no se sabe de antemano.
import { SignJWT, jwtVerify } from "jose";

export const NOMBRE_COOKIE = "sesion";

// ⚠️ Secreto de desarrollo — funciona para que el login ande sin configurar
// nada, pero es un valor conocido y público (está en este archivo). Antes de
// que esta app sea accesible por alguien más que vos en tu máquina local,
// hay que definir AUTH_SECRET en .env.local con un valor propio y secreto.
// Ver 28-login.md.
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "clave-de-desarrollo-NO-USAR-fuera-de-localhost-cambiar-en-env-local"
);

export interface SesionPayload {
  id: string;
  email: string;
  nombre: string;
  rol: string;
}

export async function firmarSesion(usuario: { id: string; email: string; nombre: string; rol: string }): Promise<string> {
  return new SignJWT({ email: usuario.email, nombre: usuario.nombre, rol: usuario.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuario.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verificarSesion(token: string): Promise<SesionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return { id: payload.sub as string, email: payload.email as string, nombre: payload.nombre as string, rol: payload.rol as string };
  } catch {
    return null; // token vencido, manipulado, o firmado con otro secreto
  }
}
