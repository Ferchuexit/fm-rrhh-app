// FM RRHH — lib/auth.ts
// Para Route Handlers y Server Components (runtime Node) — NO para el
// middleware, que usa lib/auth-edge.ts directo. bcryptjs y next/headers no
// son compatibles con el runtime Edge.
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
export * from "./auth-edge";
import { NOMBRE_COOKIE, verificarSesion } from "./auth-edge";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Para usar en Server Components — lee la cookie que ya puso /api/login.
export async function obtenerSesionActual() {
  const token = cookies().get(NOMBRE_COOKIE)?.value;
  if (!token) return null;
  return verificarSesion(token);
}
