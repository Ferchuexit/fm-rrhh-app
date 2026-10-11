// FM RRHH — middleware.ts (en la raíz del proyecto, no dentro de app/)
// Corre antes que cualquier página o ruta de API. Acá se resuelven DOS
// cosas, en un solo lugar, para no tener que repetir el chequeo en cada
// ruta suelta:
//   1. Autenticación: ¿hay sesión válida?
//   2. Autorización: ¿el rol de esa sesión puede hacer lo que está pidiendo?
//
// Dos comportamientos distintos a propósito, según qué se bloquea:
//   - Una página (navegación normal) → redirige
//   - Una ruta de API (/api/...) → devuelve el error en JSON, NUNCA una
//     redirección — si una ruta de API devolviera HTML, cualquier pantalla
//     que hace fetch(...).then(r=>r.json()) se rompería con "Unexpected end
//     of JSON input" — el mismo tipo de bug que ya apareció dos veces en
//     este proyecto por mezclar ambos mundos sin querer.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NOMBRE_COOKIE, verificarSesion } from "@/lib/auth-edge";
import { NOMBRE_COOKIE_PORTAL, verificarSesionPortal } from "@/lib/portal-edge";

import { esRutaPublica, puedeAcceder, permisosEnEmpresa, permisosHeredados } from "@/lib/permisos";

// Qué rutas son públicas, cuáles son solo de admin y qué módulo protege
// cada una está en lib/permisos.ts — un solo lugar, que también leen el
// menú y la pantalla de roles. Acá solo se aplica.

// Los permisos viajan en el token (el middleware corre en Edge y no puede
// consultar la base). Para que un cambio de rol no tarde en verse:
//   - al navegar a una pantalla, si tienen más de 5 minutos se renuevan
//     pasando por /api/sesion/renovar (un redirect que no se nota);
//   - una llamada de API con permisos de más de 8 horas se rechaza — es el
//     caso de una pestaña que quedó abierta todo el día sin navegar.
const REFRESCO_SEG = 5 * 60;
const TOPE_API_SEG = 8 * 60 * 60;

// Le pasamos el pathname a los Server Components vía header — Nav.tsx lo
// lee para no renderizarse en /terminal (pantalla de kiosco, sin el menú
// del sistema). No hay forma más directa de que un layout/Server Component
// sepa la ruta actual en Next 14 sin esto.
function siguienteConPathname(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

// ── Portal del empleado ──────────────────────────────────────────────
// Todo lo que cuelga de /portal y /api/portal es un mundo aparte: se entra
// con la cookie del EMPLEADO (sesion_portal), nunca con la del sistema, y
// al revés — con sesion_portal no se pasa a ninguna otra ruta. Por eso se
// resuelve acá arriba y retorna siempre: nada de /portal llega a las
// reglas de roles de más abajo.
// Los cuatro archivos de abajo son lo que el celular necesita para instalar
// el portal y recibir avisos: los pide el sistema operativo, a veces sin la
// sesión del empleado, y no contienen ningún dato.
const PORTAL_PUBLICAS = ["/portal/login", "/api/portal/login", "/api/portal/logout", "/portal/sw.js", "/portal/app.webmanifest", "/portal/icono-192.png", "/portal/icono-512.png", "/portal/icono-180.png"];
const PORTAL_CON_PIN_TEMPORAL = ["/portal/cambiar-pin", "/api/portal/cambiar-pin"];

async function middlewarePortal(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esApi = pathname.startsWith("/api/");
  if (PORTAL_PUBLICAS.includes(pathname)) return siguienteConPathname(req);

  const token = req.cookies.get(NOMBRE_COOKIE_PORTAL)?.value;
  const sesion = token ? await verificarSesionPortal(token) : null;
  if (!sesion) {
    if (esApi) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    return NextResponse.redirect(new URL("/portal/login", req.url));
  }

  // Con el PIN temporal que entregó RR.HH. no se ve nada todavía: primero
  // hay que elegir uno propio (si no, quien generó el PIN podría entrar y
  // firmar un recibo en nombre del empleado).
  if (sesion.debeCambiarPin && !PORTAL_CON_PIN_TEMPORAL.includes(pathname)) {
    if (esApi) return NextResponse.json({ error: "Primero tenés que elegir tu PIN propio." }, { status: 403 });
    return NextResponse.redirect(new URL("/portal/cambiar-pin", req.url));
  }
  return siguienteConPathname(req);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/api/portal/")) {
    return middlewarePortal(req);
  }

  if (esRutaPublica(pathname)) {
    return siguienteConPathname(req);
  }

  const token = req.cookies.get(NOMBRE_COOKIE)?.value;
  const sesion = token ? await verificarSesion(token) : null;

  if (!sesion) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado. Iniciá sesión de nuevo en /login." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── ¿Los permisos del token están al día? ──
  const esApi = pathname.startsWith("/api/");
  const esRenovacion = pathname === "/api/sesion/renovar";
  const edad = sesion.pa ? Math.floor(Date.now() / 1000) - sesion.pa : Infinity;
  const esNavegacion = !esApi && req.method === "GET" && !req.headers.has("rsc") && !req.headers.has("next-router-prefetch");
  if (!esRenovacion && esNavegacion && edad > REFRESCO_SEG && !req.cookies.has("sesion_renovada")) {
    const url = new URL("/api/sesion/renovar", req.url);
    url.searchParams.set("volver", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (esApi && !esRenovacion && sesion.pa && edad > TOPE_API_SEG) {
    return NextResponse.json({ error: "Esta pestaña quedó abierta mucho tiempo. Recargá la página (F5) para seguir." }, { status: 401 });
  }

  // ── Autorización: por módulo, según el rol del usuario en la empresa actual ──
  // Un token de antes de los roles no trae permisos: se evalúa con lo que
  // ese usuario podía entonces (operador / lectura), hasta que se renueve.
  const esAdmin = sesion.rol === "admin";
  const permisos = esAdmin ? null : sesion.pt ? permisosEnEmpresa(sesion.pt, req.cookies.get("empresaActual")?.value) : permisosHeredados(sesion.rol);
  if (!puedeAcceder(pathname, req.method, esAdmin, permisos)) {
    if (esApi) {
      return NextResponse.json({ error: "Tu rol no tiene permiso para esta acción en la empresa actual. Si lo necesitás, pedíselo al administrador." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return siguienteConPathname(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
