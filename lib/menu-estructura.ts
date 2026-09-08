// FM RRHH — lib/menu-estructura.ts
// Estructura única de navegación, compartida entre Nav.tsx (barra de
// arriba) y app/page.tsx (home) — un solo lugar para agregar o mover un
// módulo, no dos listas que se puedan desincronizar.
//
// Mapeo contra el árbol propuesto por el usuario — con honestidad sobre lo
// que todavía no es una pantalla propia:
//   - "Convenios", "Categorías", "Escalas" (Maestros): las tres tienen
//     pantalla propia ahora — /convenios (vuelta 53), /categorias
//     (vuelta 53), /escalas (vuelta 55, con historial de aumentos sin
//     pisar el valor anterior).
//   - "Mensual/Quincenal/SAC/Finales/Reliquidaciones" (Liquidaciones): sigue
//     siendo un solo motor que calcula el período seleccionado (mensual o
//     quincenal, según cómo se creó el período) — desde 44-liquidar-separado.md
//     tiene pantalla propia con filtros (todos / por convenio / por rango de
//     legajo), separada de /legajos. Rediseño del módulo de Liquidaciones
//     (punto 1) separó esa pantalla en dos: /liquidacion-masiva (la de
//     siempre, sin cambios de comportamiento) y /liquidacion-individual
//     (nueva — trabajo detallado sobre un único legajo, por ahora de solo
//     lectura; la edición en vivo — forzar importe, agregar/quitar concepto —
//     es la etapa siguiente, todavía no implementada). La ruta vieja /liquidar
//     quedó como redirect. SAC, liquidaciones finales y reliquidaciones no
//     existen como flujos separados todavía.
//   - "Preliquidación" (Procesos): SÍ tiene pantalla propia —
//     /preliquidacion, agregada en 41-preliquidacion.md.
//   - "Validación, Cierre" (Procesos): viven juntas en /auditoria.
//   - "Permisos" (Administración): no es pantalla propia — vive en
//     /usuarios (el rol de cada usuario) y en middleware.ts (qué puede
//     hacer cada rol).
//   - "Auditoría" (Administración): en el árbol del usuario esto sugiere
//     una bitácora de cambios (quién editó qué) — ESO no existe todavía
//     (el modelo AuditLog nunca se wireó, ver 30-migracion-postgres.md).
//     Lo que hoy se llama "Auditoría" en la app es otra cosa: el semáforo
//     de validación antes de cerrar un período — por eso vive en
//     "Procesos", no en "Administración".
export interface ItemMenu {
  href: string;
  label: string;
  icono: string;
  desc: string;
  soloAdmin?: boolean;
}

export interface CategoriaMenu {
  categoria: string;
  items: ItemMenu[];
}

export const ESTRUCTURA_MENU: CategoriaMenu[] = [
  {
    categoria: "Maestros",
    items: [
      { href: "/empresas", label: "Empresas", icono: "🏢", desc: "Clientes de la consultora", soloAdmin: true },
      { href: "/legajos", label: "Legajos", icono: "👥", desc: "Empleados y ficha completa" },
      { href: "/convenios", label: "Convenios", icono: "📜", desc: "Alta de convenios nuevos", soloAdmin: true },
      { href: "/categorias", label: "Categorías", icono: "🗂️", desc: "Categorías por convenio", soloAdmin: true },
      { href: "/escalas", label: "Escalas", icono: "💵", desc: "Básico/valor hora, con historial de aumentos", soloAdmin: true },
      { href: "/conceptos", label: "Conceptos", icono: "🔢", desc: "Catálogo con numeración real", soloAdmin: true },
      { href: "/reglas", label: "Reglas", icono: "🧮", desc: "Fórmulas del motor de cálculo", soloAdmin: true },
    ],
  },
  {
    categoria: "Novedades",
    items: [
      { href: "/novedades", label: "Novedades", icono: "📥", desc: "Excel, carga manual y validación" },
      { href: "/asistencia", label: "Asistencia", icono: "🗓️", desc: "Calendario de presentes/ausentes, desde fichadas" },
    ],
  },
  {
    categoria: "Liquidaciones",
    items: [
      { href: "/periodos", label: "Períodos", icono: "🗓️", desc: "Mensuales, quincenas, fechas reales" },
      { href: "/liquidacion-masiva", label: "Liquidación Masiva", icono: "🧾", desc: "Filtrar por convenio, rango, o todos" },
      { href: "/liquidacion-individual", label: "Liquidación Individual", icono: "🧍", desc: "Ver el recibo de un legajo puntual, con navegación" },
      { href: "/recibos", label: "Recibos", icono: "📄", desc: "Descarga masiva — PDF combinado" },
      { href: "/vacaciones", label: "Vacaciones", icono: "🏖️", desc: "Notificación, pendientes, Gantt" },
    ],
  },
  {
    categoria: "Procesos",
    items: [
      { href: "/preliquidacion", label: "Preliquidación", icono: "📋", desc: "Resumen legible, exportable para aprobación" },
      { href: "/auditoria", label: "Auditoría y cierre", icono: "🚦", desc: "Semáforo y cierre del período" },
    ],
  },
  {
    categoria: "Salidas",
    items: [{ href: "/exportar", label: "Exportar", icono: "📤", desc: "LSD y consolidado F.931" }],
  },
  {
    categoria: "Reportes",
    items: [
      { href: "/dashboard", label: "Dashboard", icono: "📈", desc: "Indicadores y KPIs de decisión" },
      { href: "/kpis", label: "KPI's", icono: "📊", desc: "Ausentismo, puntualidad y motivos" },
      { href: "/costo-laboral", label: "Costo laboral", icono: "💰", desc: "Total, por mes, convenio y categoría" },
      { href: "/exportar-personalizado", label: "Exportador personalizado", icono: "📑", desc: "Elegí campos y descargá un Excel a medida" },
    ],
  },
  {
    categoria: "Administración",
    items: [
      { href: "/usuarios", label: "Usuarios", icono: "🔐", desc: "Altas, roles y permisos", soloAdmin: true },
      { href: "/parametros", label: "Parámetros", icono: "📊", desc: "Topes vigentes por período", soloAdmin: true },
      { href: "/estado-implementacion", label: "Estado por convenio", icono: "📋", desc: "Qué está cargado en cada CCT", soloAdmin: true },
      { href: "/actualizaciones-normativas", label: "Actualizaciones normativas", icono: "📜", desc: "Bitácora de cambios de ley, CCT, y ARCA aplicados", soloAdmin: true },
    ],
  },
];

// Filtra por rol, y descarta categorías que quedan vacías después del filtro.
export function menuFiltradoPorRol(rol: string | undefined): CategoriaMenu[] {
  return ESTRUCTURA_MENU.map((cat) => ({
    categoria: cat.categoria,
    items: cat.items.filter((i) => !i.soloAdmin || rol === "admin"),
  })).filter((cat) => cat.items.length > 0);
}
