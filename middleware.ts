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

const RUTAS_PUBLICAS = [
  "/login",
  "/api/login",
  // Control de Asistencia — la terminal instalada en el cliente no tiene
  // sesión de usuario, se identifica con su dispositivoId (código de
  // vinculación de un solo uso, después el id del dispositivo). Ver la
  // nota de diseño en prisma/schema.prisma, modelo DispositivoAsistencia.
  "/api/dispositivos/vincular",
  "/api/dispositivos/heartbeat",
  "/api/fichadas/terminal",
];

// Configuración del sistema — solo admin. Si un rol no-admin entra a
// legajos, novedades, vacaciones, etc. (el trabajo del día a día), pasa
// normal — esto es solo para lo que puede romper el cálculo de todos si se
// toca mal (reglas, conceptos, parámetros, usuarios).
const RUTAS_ADMIN = ["/usuarios", "/api/usuarios", "/empresas", "/api/empresas", "/conceptos", "/api/conceptos", "/reglas", "/api/reglas", "/parametros", "/api/parametros", "/api/rangos", "/convenios", "/categorias", "/escalas", "/estado-implementacion", "/api/estado-implementacion", "/actualizaciones-normativas", "/api/actualizaciones-normativas", "/dispositivos", "/api/dispositivos"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (RUTAS_PUBLICAS.includes(pathname)) {
    return NextResponse.next();
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

  // ── Autorización: rutas de configuración, solo admin ──
  const esRutaAdmin = RUTAS_ADMIN.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (esRutaAdmin && sesion.rol !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Esta acción requiere rol de administrador." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ── Autorización: rol "lectura" no puede modificar nada, en ningún lado.
  // Las páginas siempre se piden por GET (navegar no escribe nada) — lo que
  // hay que bloquear son los métodos que sí escriben, sin importar la ruta.
  if (sesion.rol === "lectura" && !["GET", "HEAD"].includes(req.method)) {
    return NextResponse.json({ error: "Tu usuario tiene permiso de solo lectura — esta acción está bloqueada." }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
