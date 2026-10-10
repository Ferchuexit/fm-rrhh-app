// FM RRHH — app/api/sesion/renovar/route.ts
// Vuelve a emitir el token de sesión con los permisos de AHORA. El
// middleware manda acá al navegador cuando los permisos del token tienen
// más de unos minutos (él no puede consultar la base; esta ruta sí).
//
// Es también lo que hace que borrar un usuario o sacarle el rol admin
// tenga efecto enseguida: si el usuario ya no existe, acá se le cierra la
// sesión en vez de renovársela.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOMBRE_COOKIE, obtenerSesionActual } from "@/lib/auth";
import { cookieDeSesion } from "@/lib/permisos-servidor";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Solo se vuelve a una ruta de este mismo sitio ("/algo"), nunca a una
  // dirección externa que alguien haya puesto en el link.
  const pedido = new URL(req.url).searchParams.get("volver") ?? "/";
  const volver = pedido.startsWith("/") && !pedido.startsWith("//") && !pedido.startsWith("/api/sesion") ? pedido : "/";

  const sesion = await obtenerSesionActual();
  const usuario = sesion ? await prisma.usuario.findUnique({ where: { id: sesion.id }, select: { id: true, email: true, nombre: true, rol: true } }) : null;
  if (!usuario) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(NOMBRE_COOKIE);
    return res;
  }

  const res = NextResponse.redirect(new URL(volver, req.url));
  res.cookies.set(await cookieDeSesion(usuario));
  // Marca de "recién renovada": si por lo que sea el navegador no guardara
  // la cookie nueva, el middleware no vuelve a mandar acá en un bucle.
  res.cookies.set("sesion_renovada", "1", { path: "/", maxAge: 60, httpOnly: true, sameSite: "lax" });
  return res;
}
