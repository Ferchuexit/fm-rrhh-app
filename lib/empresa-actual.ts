// FM RRHH — lib/empresa-actual.ts
// Igual que la sesión de login, pero para "con qué empresa estoy
// trabajando ahora" — una cookie liviana (no httpOnly, no necesita firma:
// no es un dato sensible, es solo una preferencia de navegación) que guarda
// el empresaId elegido.
//
// ANTES: esta función confiaba ciegamente en la cookie — cualquier usuario
// logueado podía cambiar a CUALQUIER empresa de la base sin que nada lo
// verificara. Es el hueco de seguridad real que describe el documento de
// mejora — grave el día que un cliente tenga su propio usuario, invisible
// mientras el único usuario sea Fernando.
//
// AHORA: Usuario.rol === 'admin' (FM Consultora, dueño del sistema) sigue
// teniendo acceso global a propósito. Cualquier otro usuario SOLO puede
// acceder a las empresas que tenga en UsuarioEmpresa — si la cookie apunta
// a una que no le corresponde, se ignora y cae a la primera empresa
// autorizada (nunca a "la primera empresa que exista", que sería otro
// agujero).
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { obtenerSesionActual } from "./auth";

export const NOMBRE_COOKIE_EMPRESA = "empresaActual";

export async function obtenerEmpresasAutorizadas() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return [];

  if (sesion.rol === "admin") {
    return prisma.empresa.findMany({ orderBy: { razonSocial: "asc" } });
  }

  const asignaciones = await prisma.usuarioEmpresa.findMany({
    where: { usuarioId: sesion.id },
    include: { empresa: true },
    orderBy: { empresa: { razonSocial: "asc" } },
  });
  return asignaciones.map((a) => a.empresa);
}

export async function obtenerEmpresaActual() {
  const empresasAutorizadas = await obtenerEmpresasAutorizadas();
  if (empresasAutorizadas.length === 0) return null;

  const empresaId = cookies().get(NOMBRE_COOKIE_EMPRESA)?.value;
  if (empresaId) {
    const encontrada = empresasAutorizadas.find((e) => e.id === empresaId);
    if (encontrada) return encontrada;
    // la cookie apunta a una empresa que no existe, ya no está autorizada,
    // o directamente nunca le correspondió a este usuario — se ignora,
    // cae a la primera AUTORIZADA (no a "la primera que exista").
  }

  return empresasAutorizadas[0];
}
