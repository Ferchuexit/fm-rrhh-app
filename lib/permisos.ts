// FM RRHH — lib/permisos.ts
// Roles y permisos por módulo (docs/80-roles-y-permisos.md).
//
// ⚠️ Este archivo lo importa middleware.ts (runtime Edge): solo lógica pura,
// nada de Prisma ni next/headers. Y es EL lugar donde se decide qué módulo
// protege cada pantalla y cada ruta de API — el menú, el middleware y la
// pantalla de roles leen todos de acá.
//
// Modelo:
//   - Un ROL es una grilla módulo → nivel ('ver' | 'gestionar'; ausente = sin acceso).
//   - El rol se asigna POR EMPRESA (UsuarioEmpresa.rolId).
//   - Usuario.rol === 'admin' (la consultora) no pasa por la grilla: puede todo.
//   - Usuarios, roles y empresas son SOLO de admin — no se pueden delegar.

export type Nivel = "ver" | "gestionar";
export type Permisos = Record<string, Nivel>;

export interface DefModulo {
  clave: string;
  nombre: string;
  bloque: "Liquidación de sueldos" | "Gestión Humana";
  desc: string;
  // Prefijos de pantallas y de rutas de API que este módulo protege.
  rutas: string[];
}

export const MODULOS: DefModulo[] = [
  {
    clave: "legajos", nombre: "Legajos", bloque: "Liquidación de sueldos", desc: "Ficha de cada empleado, documentos, embargos, cargas de familia",
    rutas: ["/legajos", "/api/legajos", "/api/documentos", "/api/cargas-familia", "/api/embargos", "/api/cuotas-embargo", "/api/periodos-anteriores", "/api/docente-cargos", "/api/docente-designaciones", "/api/centros-costo", "/api/sucursales"],
  },
  { clave: "novedades", nombre: "Novedades", bloque: "Liquidación de sueldos", desc: "Carga por Excel o manual y validación", rutas: ["/novedades", "/api/novedades"] },
  {
    clave: "liquidaciones", nombre: "Liquidaciones y recibos", bloque: "Liquidación de sueldos", desc: "Períodos, liquidación masiva e individual, preliquidación, recibos",
    rutas: ["/periodos", "/liquidacion-masiva", "/liquidacion-individual", "/liquidar", "/recibos", "/preliquidacion", "/api/periodos", "/api/liquidar", "/api/liquidacion-individual", "/api/liquidacion-detalle", "/api/agregar", "/api/recibo", "/api/recibos", "/api/preliquidacion", "/api/auditar-preliquidacion"],
  },
  { clave: "cierre", nombre: "Auditoría y cierre", bloque: "Liquidación de sueldos", desc: "Semáforo de validación, aprobación y cierre del período", rutas: ["/auditoria", "/api/auditar", "/api/auditoria-comparativa", "/api/aprobar", "/api/cerrar"] },
  { clave: "exportar", nombre: "Exportar a ARCA", bloque: "Liquidación de sueldos", desc: "Libro de Sueldos Digital y consolidado F.931", rutas: ["/exportar", "/api/exportar"] },
  {
    clave: "reportes", nombre: "Reportes", bloque: "Liquidación de sueldos", desc: "Dashboard, KPI's, costo laboral, exportador personalizado",
    rutas: ["/dashboard", "/kpis", "/costo-laboral", "/exportar-personalizado", "/api/dashboard", "/api/kpis", "/api/centro-control", "/api/informe-gerencial", "/api/proyeccion-costo-laboral", "/api/exportar-personalizado", "/api/reportes"],
  },
  {
    clave: "configuracion", nombre: "Configuración de sueldos", bloque: "Liquidación de sueldos", desc: "Convenios, categorías, escalas, conceptos, reglas, parámetros — lo que cambia el cálculo de todos",
    rutas: ["/convenios", "/categorias", "/escalas", "/conceptos", "/reglas", "/parametros", "/estado-implementacion", "/actualizaciones-normativas", "/api/convenios", "/api/categorias", "/api/escalas", "/api/conceptos", "/api/reglas", "/api/parametros", "/api/rangos", "/api/estado-implementacion", "/api/actualizaciones-normativas"],
  },
  { clave: "noticias", nombre: "Noticias", bloque: "Gestión Humana", desc: "Comunicados a los empleados y su lectura", rutas: ["/noticias", "/api/noticias"] },
  { clave: "legajo_digital", nombre: "Legajo digital", bloque: "Gestión Humana", desc: "Checklist de documentación, bandeja de revisión, onboarding de ingresos y offboarding de egresos", rutas: ["/legajo-digital", "/api/legajo-digital", "/onboarding", "/api/onboarding", "/offboarding", "/api/offboarding"] },
  { clave: "vacaciones", nombre: "Vacaciones y permisos", bloque: "Gestión Humana", desc: "Registro, Gantt y solicitudes del portal", rutas: ["/vacaciones", "/solicitudes", "/api/vacaciones", "/api/solicitudes"] },
  { clave: "firmas_recibos", nombre: "Firmas de recibos", bloque: "Gestión Humana", desc: "Quién vio y firmó su recibo", rutas: ["/firmas-recibos", "/api/firmas-recibos"] },
  { clave: "asistencia", nombre: "Asistencia y fichadas", bloque: "Gestión Humana", desc: "Horarios y turnos, calendario de asistencia y corrección de fichadas", rutas: ["/asistencia", "/fichadas", "/turnos", "/api/asistencia", "/api/fichadas", "/api/periodos-asistencia", "/api/turnos"] },
  // /api/empresas/actual (el logo que muestra la terminal) cuelga de acá y
  // no de "empresas" (solo admin): lo usa la pantalla de Dispositivos.
  { clave: "dispositivos", nombre: "Dispositivos de fichada", bloque: "Gestión Humana", desc: "Terminales instaladas en la empresa y su PIN", rutas: ["/dispositivos", "/api/dispositivos", "/api/empresas/actual"] },
  { clave: "capacitaciones", nombre: "Capacitaciones y habilidades", bloque: "Gestión Humana", desc: "Capacitaciones con constancia firmada y matriz de quién está habilitado para qué", rutas: ["/capacitaciones", "/habilidades", "/api/capacitaciones", "/api/habilidades"] },
  { clave: "evaluaciones", nombre: "Evaluación de desempeño", bloque: "Gestión Humana", desc: "Ciclos de evaluación, resultados de cada persona y su entrega", rutas: ["/evaluaciones", "/api/evaluaciones"] },
  { clave: "reclutamiento", nombre: "Puestos y reclutamiento", bloque: "Gestión Humana", desc: "Perfiles de puesto, organigrama, búsquedas y candidatos", rutas: ["/puestos", "/api/puestos", "/reclutamiento", "/api/reclutamiento"] },
  { clave: "cultura", nombre: "Cultura", bloque: "Gestión Humana", desc: "Reconocimientos, cumpleaños y aniversarios, eventos y programa de referidos", rutas: ["/reconocimientos", "/api/reconocimientos", "/celebraciones", "/api/celebraciones", "/eventos", "/api/eventos", "/referidos", "/api/referidos"] },
  { clave: "encuestas", nombre: "Encuestas de clima", bloque: "Gestión Humana", desc: "Encuestas anónimas de clima laboral y sus resultados", rutas: ["/encuestas", "/api/encuestas"] },
  { clave: "objetivos", nombre: "Objetivos y plan de carrera", bloque: "Gestión Humana", desc: "Objetivos de cada persona con su avance, y a qué puesto apunta", rutas: ["/objetivos", "/api/objetivos"] },
  { clave: "accesos_portal", nombre: "Accesos al portal", bloque: "Gestión Humana", desc: "Generar y resetear el PIN de los empleados", rutas: ["/accesos-portal", "/api/accesos-portal"] },
];

export const CLAVES_MODULO = MODULOS.map((m) => m.clave);

// Solo admin, sin excepción: quién entra, qué puede y a qué empresas.
export const RUTAS_SOLO_ADMIN = ["/usuarios", "/api/usuarios", "/roles", "/api/roles", "/empresas", "/api/empresas"];

// Sin sesión (terminal de fichadas y login). Coincidencia EXACTA.
export const RUTAS_PUBLICAS = [
  "/login", "/api/login",
  "/api/dispositivos/vincular", "/api/dispositivos/heartbeat", "/api/fichadas/terminal", "/api/dispositivos/legajos",
  "/api/dispositivos/biometria", "/api/dispositivos/biometria/enrolar", "/api/dispositivos/verificar-pin", "/terminal",
  // La tarea diaria que dispara Vercel: sin sesión, protegida con CRON_SECRET.
  "/api/cron/recordatorios",
];

// Sin sesión y por prefijo: la página pública de empleos, donde se postula
// gente de afuera. Todo lo que cuelgue de acá tiene que estar pensado para
// que lo vea CUALQUIERA.
export const PREFIJOS_PUBLICOS = ["/empleos", "/api/empleos"];
export const esRutaPublica = (pathname: string) => RUTAS_PUBLICAS.includes(pathname) || PREFIJOS_PUBLICOS.some((p) => pathname === p || pathname.startsWith(p + "/"));

// Cualquier usuario del panel con sesión, tenga el rol que tenga.
const RUTAS_LIBRES = ["/", "/api/logout", "/api/empresa-actual", "/api/sesion"];

// CONSULTAS COMPARTIDAS — listas que usan los desplegables de casi todas
// las pantallas (elegir período, convenio, sector, empleado). Solo GET y
// solo la ruta exacta: cualquiera con sesión las puede leer, pero para
// MODIFICARLAS hace falta el módulo dueño. /api/legajos devuelve nada más
// que número y nombre; la ficha completa (/api/legajos/[id]) no entra acá.
const CONSULTAS_COMPARTIDAS = ["/api/legajos", "/api/periodos", "/api/convenios", "/api/categorias", "/api/centros-costo", "/api/sucursales", "/api/conceptos"];

// Rutas que se CONSULTAN legítimamente desde más de un módulo. Para leer
// alcanza con tener cualquiera de los listados; para MODIFICAR sigue
// mandando solo el módulo dueño (el primero) — tener Vacaciones deja mirar
// la ficha de un empleado, no editarla.
const RUTAS_MULTI: { prefijo: string; exacta?: RegExp; modulos: string[] }[] = [
  { prefijo: "/api/documentos", modulos: ["legajos", "legajo_digital"] }, // abrir un documento del legajo
  { prefijo: "/api/asistencia/kpis", modulos: ["asistencia", "reportes"] },
  { prefijo: "/api/reportes/asistencia-diaria", modulos: ["asistencia", "reportes"] },
  // La ficha de UN legajo (solo lectura la piden Vacaciones y Liquidación individual).
  { prefijo: "/api/legajos/", exacta: /^\/api\/legajos\/[^/]+(\/adyacentes)?$/, modulos: ["legajos", "vacaciones", "liquidaciones"] },
  // Carpeta mal nombrada que ya existía ("periodos-asistencia[id]" en vez de
  // "periodos-asistencia/[id]"): su URL real no lleva barra antes del id.
  { prefijo: "/api/periodos-asistencia", exacta: /^\/api\/periodos-asistencia[^/]+$/, modulos: ["asistencia"] },
];

// POST que no modifican nada (validan, prueban, arman un PDF): alcanza con 'ver'.
const POST_DE_CONSULTA = ["/api/reglas/probar", "/api/reglas/validar", "/api/novedades/validar", "/api/auditar", "/api/auditar-preliquidacion", "/api/recibos/exportar"];

const coincide = (pathname: string, prefijo: string) => pathname === prefijo || pathname.startsWith(prefijo.endsWith("/") ? prefijo : prefijo + "/");

export type Regla =
  | { tipo: "publica" }
  | { tipo: "libre" }
  | { tipo: "solo_admin" }
  | { tipo: "modulo"; modulos: string[]; soloParaLeer?: string[] }
  | { tipo: "sin_clasificar" };

// ¿Qué protege esta ruta? Gana siempre el prefijo MÁS LARGO, así
// /api/empresas/actual (dispositivos) le gana a /api/empresas (solo admin).
export function reglaDeRuta(pathname: string): Regla {
  if (esRutaPublica(pathname)) return { tipo: "publica" };
  if (pathname === "/" || RUTAS_LIBRES.some((r) => r !== "/" && coincide(pathname, r))) return { tipo: "libre" };

  let mejor: { largo: number; regla: Regla } | null = null;
  const probar = (prefijo: string, regla: Regla, ganaEmpate = false) => {
    if (!mejor || prefijo.length > mejor.largo || (ganaEmpate && prefijo.length === mejor.largo)) mejor = { largo: prefijo.length, regla };
  };
  for (const r of RUTAS_SOLO_ADMIN) if (coincide(pathname, r)) probar(r, { tipo: "solo_admin" });
  for (const m of MODULOS) for (const r of m.rutas) if (coincide(pathname, r)) probar(r, { tipo: "modulo", modulos: [m.clave] });
  // Las compartidas le ganan a su módulo dueño cuando el prefijo es el mismo.
  for (const r of RUTAS_MULTI) if (r.exacta ? r.exacta.test(pathname) : coincide(pathname, r.prefijo)) probar(r.prefijo, { tipo: "modulo", modulos: [r.modulos[0]], soloParaLeer: r.modulos.slice(1) }, true);
  return (mejor as { largo: number; regla: Regla } | null)?.regla ?? { tipo: "sin_clasificar" };
}

const esLectura = (metodo: string) => metodo === "GET" || metodo === "HEAD";

// LA decisión. `permisos` = grilla del rol del usuario en la empresa actual
// (null si no tiene ninguna empresa asignada).
export function puedeAcceder(pathname: string, metodo: string, esAdmin: boolean, permisos: Permisos | null): boolean {
  const regla = reglaDeRuta(pathname);
  if (regla.tipo === "publica" || regla.tipo === "libre") return true;
  if (esAdmin) return true;
  // Una ruta nueva que nadie clasificó queda cerrada para todos menos
  // admin — se nota enseguida, en vez de quedar abierta sin que nadie sepa.
  if (regla.tipo === "solo_admin" || regla.tipo === "sin_clasificar") return false;
  if (!permisos) return false;

  if (esLectura(metodo) && CONSULTAS_COMPARTIDAS.includes(pathname)) return Object.keys(permisos).length > 0;
  const soloConsulta = esLectura(metodo) || (metodo === "POST" && POST_DE_CONSULTA.includes(pathname));
  if (soloConsulta) return [...regla.modulos, ...(regla.soloParaLeer ?? [])].some((m) => permisos[m] === "ver" || permisos[m] === "gestionar");
  return regla.modulos.some((m) => permisos[m] === "gestionar");
}

export function puedeVerModulo(clave: string, esAdmin: boolean, permisos: Permisos | null): boolean {
  return esAdmin || permisos?.[clave] === "ver" || permisos?.[clave] === "gestionar";
}

// Deja solo módulos y niveles válidos — lo que llega de un formulario o
// de la base nunca se usa sin pasar por acá.
export function limpiarPermisos(entrada: unknown): Permisos {
  const salida: Permisos = {};
  if (!entrada || typeof entrada !== "object") return salida;
  for (const clave of CLAVES_MODULO) {
    const nivel = Object.prototype.hasOwnProperty.call(entrada, clave) ? (entrada as Record<string, unknown>)[clave] : undefined;
    if (nivel === "ver" || nivel === "gestionar") salida[clave] = nivel;
  }
  return salida;
}

// ── Roles "de antes" ─────────────────────────────────────────────────
// Un usuario sin rol asignado en una empresa conserva EXACTAMENTE lo que
// podía antes de que existieran los roles: 'operador' gestiona todo menos
// la configuración y los dispositivos (que eran solo de admin), y
// 'lectura' ve eso mismo sin poder modificar. Así, actualizar el sistema
// no le cambia nada a ningún usuario existente.
const ERAN_SOLO_ADMIN = ["configuracion", "dispositivos"];
export function permisosHeredados(rolGlobal: string): Permisos {
  const nivel: Nivel = rolGlobal === "lectura" ? "ver" : "gestionar";
  return Object.fromEntries(CLAVES_MODULO.filter((c) => !ERAN_SOLO_ADMIN.includes(c)).map((c) => [c, nivel]));
}

// ── Roles que vienen armados ─────────────────────────────────────────
const todo = (nivel: Nivel, excepto: string[] = []): Permisos => Object.fromEntries(CLAVES_MODULO.filter((c) => !excepto.includes(c)).map((c) => [c, nivel]));
export const ROLES_PREDEFINIDOS: { id: string; nombre: string; descripcion: string; permisos: Permisos }[] = [
  { id: "rol-rrhh-completo", nombre: "RR.HH. completo", descripcion: "Todo el trabajo de RR.HH. y liquidación de la empresa, sin tocar la configuración del cálculo.", permisos: todo("gestionar", ["configuracion"]) },
  {
    id: "rol-liquidador", nombre: "Liquidador", descripcion: "Liquida sueldos de punta a punta. De Gestión Humana solo ve asistencia, vacaciones y firmas.",
    permisos: { legajos: "gestionar", novedades: "gestionar", liquidaciones: "gestionar", cierre: "gestionar", exportar: "gestionar", reportes: "ver", asistencia: "ver", vacaciones: "ver", firmas_recibos: "ver" },
  },
  {
    id: "rol-supervisor", nombre: "Supervisor", descripcion: "Gestiona a la gente (asistencia, vacaciones, legajo digital, noticias) sin ver sueldos ni liquidaciones.",
    permisos: { legajos: "ver", asistencia: "gestionar", vacaciones: "gestionar", legajo_digital: "gestionar", noticias: "gestionar", accesos_portal: "gestionar", capacitaciones: "gestionar", objetivos: "gestionar", cultura: "gestionar" },
  },
  { id: "rol-solo-lectura", nombre: "Solo lectura", descripcion: "Ve todo lo de la empresa (menos la configuración) sin poder modificar nada.", permisos: todo("ver", ["configuracion", "dispositivos"]) },
];

// ── Permisos dentro del token de sesión ──────────────────────────────
// El middleware no puede consultar la base, así que los permisos viajan en
// el token firmado. Forma compacta para no pasarse del tamaño de una
// cookie: los roles distintos una sola vez, y por empresa solo un índice.
//   roles: ["legajos:g,novedades:v", ...]     emp: [[empresaId, índice], ...]
export interface PermisosToken { roles: string[]; emp: [string, number][] }

export const compactar = (p: Permisos) => CLAVES_MODULO.filter((c) => p[c]).map((c) => `${c}:${p[c] === "gestionar" ? "g" : "v"}`).join(",");
export function descompactar(texto: string): Permisos {
  const p: Permisos = {};
  for (const par of String(texto ?? "").split(",")) {
    const [clave, n] = par.split(":");
    if (CLAVES_MODULO.includes(clave) && (n === "g" || n === "v")) p[clave] = n === "g" ? "gestionar" : "ver";
  }
  return p;
}

export function armarPermisosToken(porEmpresa: { empresaId: string; permisos: Permisos }[]): PermisosToken {
  const roles: string[] = [];
  const emp: [string, number][] = [];
  for (const e of porEmpresa) {
    const texto = compactar(e.permisos);
    let i = roles.indexOf(texto);
    if (i === -1) i = roles.push(texto) - 1;
    emp.push([e.empresaId, i]);
  }
  return { roles, emp };
}

// Mismo criterio que obtenerEmpresaActual(): la empresa de la cookie si el
// usuario la tiene asignada; si no, la primera de su lista.
export function permisosEnEmpresa(pt: PermisosToken | null | undefined, empresaCookie: string | undefined): Permisos | null {
  if (!pt || !Array.isArray(pt.emp) || pt.emp.length === 0) return null;
  const fila = pt.emp.find(([id]) => id === empresaCookie) ?? pt.emp[0];
  return descompactar(pt.roles?.[fila[1]] ?? "");
}

// ── Alcance por sector ───────────────────────────────────────────────
// Un usuario limitado a ciertos sectores solo puede tener un rol de
// Gestión Humana, más Legajos en "ver". El filtro por sector cubre los
// datos de personas, pero no los totales de liquidación ni los reportes de
// toda la empresa: con esta regla, esas pantallas directamente no le
// aparecen. Devuelve los módulos que sobran (vacío = el rol sirve).
export function modulosIncompatiblesConSectores(permisos: Permisos): string[] {
  return MODULOS.filter((m) => {
    const nivel = permisos[m.clave];
    if (!nivel) return false;
    if (m.bloque === "Gestión Humana") return false;
    return !(m.clave === "legajos" && nivel === "ver");
  }).map((m) => m.nombre);
}
