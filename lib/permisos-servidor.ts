// FM RRHH — lib/permisos-servidor.ts
// Lado Node de los permisos (Route Handlers y Server Components): leer de
// la base qué puede cada usuario y emitir el token que después lee el
// middleware. La lógica de decisión está en lib/permisos.ts.
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { NOMBRE_COOKIE, firmarSesion, obtenerSesionActual } from "./auth";
import { NOMBRE_COOKIE_EMPRESA } from "./empresa-actual";
import { armarPermisosToken, limpiarPermisos, permisosHeredados, permisosEnEmpresa, type Permisos, type PermisosToken } from "./permisos";

// Qué puede este usuario en cada una de sus empresas, en el mismo orden
// que usa el selector de empresa (razón social).
export async function permisosDeUsuario(usuario: { id: string; rol: string }): Promise<PermisosToken> {
  if (usuario.rol === "admin") return { roles: [], emp: [] }; // admin no pasa por la grilla
  const asignaciones = await prisma.usuarioEmpresa.findMany({
    where: { usuarioId: usuario.id },
    select: { empresaId: true, rol: { select: { permisos: true } } },
    orderBy: { empresa: { razonSocial: "asc" } },
  });
  return armarPermisosToken(asignaciones.map((a) => ({ empresaId: a.empresaId, permisos: a.rol ? limpiarPermisos(a.rol.permisos) : permisosHeredados(usuario.rol) })));
}

export async function cookieDeSesion(usuario: { id: string; email: string; nombre: string; rol: string }) {
  return {
    name: NOMBRE_COOKIE,
    value: await firmarSesion(usuario, await permisosDeUsuario(usuario)),
    httpOnly: true, // no accesible desde JS del navegador — reduce el riesgo de robo por XSS
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  };
}

// Para dibujar el menú y la home: los permisos de AHORA, leídos de la base
// (no los del token, que pueden tener unos minutos).
export async function permisosActuales(): Promise<{ esAdmin: boolean; permisos: Permisos | null } | null> {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  const usuario = await prisma.usuario.findUnique({ where: { id: sesion.id }, select: { id: true, rol: true } });
  if (!usuario) return null;
  if (usuario.rol === "admin") return { esAdmin: true, permisos: null };
  return { esAdmin: false, permisos: permisosEnEmpresa(await permisosDeUsuario(usuario), cookies().get(NOMBRE_COOKIE_EMPRESA)?.value) };
}

// Importes de sueldos fuera del módulo Liquidaciones (planificación de
// vacaciones, presupuestos): solo para quien igual podría verlos ahí.
export async function puedeVerCostos(): Promise<boolean> {
  const quien = await permisosActuales();
  return !!quien && (quien.esAdmin || !!quien.permisos?.liquidaciones);
}
