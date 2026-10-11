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
//
// Menú lateral (docs/77-menu-lateral.md): las categorías se agrupan en dos
// BLOQUES — "Liquidación de sueldos" (lo que el sistema ya era) y "Gestión
// Humana" (los módulos que se van sumando, con los nombres de área que usa
// el mercado: Gestión de RR.HH., Operaciones, Plataforma...). Sumar un área
// nueva (Comunicación interna, Desarrollo de talento, Cultura) es agregar
// una entrada acá; una categoría sin ítems visibles no se dibuja.
import { puedeAcceder, type Permisos } from "./permisos";

export interface ItemMenu {
  href: string;
  label: string;
  icono: string;
  desc: string;
  soloAdmin?: boolean; // usuarios, roles y empresas: no se delegan
}

export interface CategoriaMenu {
  bloque: string;
  categoria: string;
  icono: string;
  items: ItemMenu[];
}

const SUELDOS = "Liquidación de sueldos";
const GESTION = "Gestión Humana";

export const ESTRUCTURA_MENU: CategoriaMenu[] = [
  {
    bloque: SUELDOS,
    categoria: "Maestros",
    icono: "🗂️",
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
    bloque: SUELDOS,
    categoria: "Novedades",
    icono: "📥",
    items: [{ href: "/novedades", label: "Novedades", icono: "📥", desc: "Excel, carga manual y validación" }],
  },
  {
    bloque: SUELDOS,
    categoria: "Liquidaciones",
    icono: "🧾",
    items: [
      { href: "/periodos", label: "Períodos", icono: "🗓️", desc: "Mensuales, quincenas, fechas reales" },
      { href: "/liquidacion-masiva", label: "Liquidación Masiva", icono: "🧾", desc: "Filtrar por convenio, rango, o todos" },
      { href: "/liquidacion-individual", label: "Liquidación Individual", icono: "🧍", desc: "Ver el recibo de un legajo puntual, con navegación" },
      { href: "/recibos", label: "Recibos", icono: "📄", desc: "Descarga masiva — PDF combinado" },
    ],
  },
  {
    bloque: SUELDOS,
    categoria: "Procesos",
    icono: "🚦",
    items: [
      { href: "/preliquidacion", label: "Preliquidación", icono: "📋", desc: "Resumen legible, exportable para aprobación" },
      { href: "/auditoria", label: "Auditoría y cierre", icono: "🚦", desc: "Semáforo y cierre del período" },
    ],
  },
  {
    bloque: SUELDOS,
    categoria: "Salidas",
    icono: "📤",
    items: [{ href: "/exportar", label: "Exportar", icono: "📤", desc: "LSD y consolidado F.931" }],
  },
  {
    bloque: SUELDOS,
    categoria: "Reportes",
    icono: "📈",
    items: [
      { href: "/dashboard", label: "Dashboard", icono: "📈", desc: "Indicadores y KPIs de decisión" },
      { href: "/kpis", label: "KPI's", icono: "📊", desc: "Ausentismo, puntualidad y motivos" },
      { href: "/costo-laboral", label: "Costo laboral", icono: "💰", desc: "Total, por mes, convenio y categoría" },
      { href: "/exportar-personalizado", label: "Exportador personalizado", icono: "📑", desc: "Elegí campos y descargá un Excel a medida" },
    ],
  },
  {
    bloque: SUELDOS,
    categoria: "Configuración",
    icono: "⚙️",
    items: [
      { href: "/parametros", label: "Parámetros", icono: "📊", desc: "Topes vigentes por período", soloAdmin: true },
      { href: "/estado-implementacion", label: "Estado por convenio", icono: "📋", desc: "Qué está cargado en cada CCT", soloAdmin: true },
      { href: "/actualizaciones-normativas", label: "Actualizaciones normativas", icono: "📜", desc: "Bitácora de cambios de ley, CCT, y ARCA aplicados", soloAdmin: true },
    ],
  },
  {
    bloque: GESTION,
    categoria: "Comunicación interna",
    icono: "📣",
    items: [
      { href: "/agenda", label: "Agenda", icono: "🗓️", desc: "El calendario de la empresa: eventos, capacitaciones, vacaciones, feriados y festejos" },
      { href: "/organigrama", label: "Organigrama", icono: "🌳", desc: "Quién ocupa cada puesto y quién reporta a quién" },
      { href: "/biblioteca", label: "Librería de conocimiento", icono: "📚", desc: "Reglamento, procedimientos, instructivos y preguntas frecuentes, con buscador en el portal" },
      { href: "/chat", label: "Chat y grupos", icono: "💬", desc: "Grupos de la empresa y consultas de los empleados a RR.HH." },{ href: "/noticias", label: "Noticias", icono: "📣", desc: "Comunicados a los empleados, con acuse de lectura" }],
  },
  {
    // Lo que RR.HH. gestiona con el empleado. Las tres últimas pantallas son
    // el lado RR.HH. del portal (docs/75 y 76); lo que ve el empleado vive
    // en /portal, con su propio login, y no aparece en este menú.
    bloque: GESTION,
    categoria: "Gestión de RR.HH.",
    icono: "🤝",
    items: [
      { href: "/onboarding", label: "Onboarding", icono: "🚀", desc: "Pasos de ingreso de cada empleado nuevo: quién hace qué y cómo viene" },
      { href: "/offboarding", label: "Offboarding", icono: "🚪", desc: "Pasos de salida de quien deja la empresa, entrevista de salida y motivos de rotación" },
      { href: "/legajo-digital", label: "Legajo digital", icono: "📁", desc: "Checklist de documentación de cada empleado y revisión" },
      { href: "/vacaciones", label: "Vacaciones", icono: "🏖️", desc: "Notificación, pendientes, Gantt" },
      { href: "/solicitudes", label: "Solicitudes", icono: "📨", desc: "Pedidos de vacaciones y permisos para aprobar" },
      { href: "/firmas-recibos", label: "Firmas de recibos", icono: "✍️", desc: "Quién vio y firmó su recibo, por período" },
    ],
  },
  {
    // Capacitar a la gente y saber quién está habilitado para qué.
    bloque: GESTION,
    categoria: "Desarrollo de talento",
    icono: "🎓",
    items: [
      { href: "/capacitaciones", label: "Capacitaciones", icono: "🎓", desc: "Programar, tomar asistencia y constancia firmada por el empleado" },
      { href: "/evaluaciones", label: "Evaluación de desempeño", icono: "⭐", desc: "Ciclos de evaluación: el jefe evalúa, RR.HH. revisa y entrega, el empleado firma" },
      { href: "/puestos", label: "Puestos y organigrama", icono: "🧭", desc: "El perfil de cada puesto, de quién depende y dónde hay vacantes" },
      { href: "/reclutamiento", label: "Reclutamiento", icono: "🔎", desc: "Búsquedas abiertas, candidatos por etapa y página pública de empleos" },
      { href: "/encuestas", label: "Encuestas de clima", icono: "📋", desc: "Encuestas anónimas: cómo está el clima, por dimensión y por sector" },
      { href: "/objetivos", label: "Objetivos y plan de carrera", icono: "🎯", desc: "Qué se espera de cada uno, cómo viene, y qué le falta para el puesto al que apunta" },
      { href: "/habilidades", label: "Matriz de habilidades", icono: "🧩", desc: "Quién está habilitado para cada puesto o máquina, y qué está por vencer" },
    ],
  },
  {
    // Lo que hace a la gente sentirse parte: reconocer, celebrar.
    bloque: GESTION,
    categoria: "Cultura",
    icono: "🎉",
    items: [
      { href: "/reconocimientos", label: "Reconocimientos", icono: "👏", desc: "El muro donde los compañeros se reconocen por los valores de la empresa" },
      { href: "/publicaciones", label: "Publicaciones del muro", icono: "📷", desc: "Lo que la gente comparte en el muro: publicar como empresa y moderar" },
      { href: "/celebraciones", label: "Cumpleaños y aniversarios", icono: "🎂", desc: "Quién cumple años y quién cumple años en la empresa" },
      { href: "/eventos", label: "Eventos", icono: "📅", desc: "Lo que organiza la empresa: se publica, la gente confirma y se sabe con cuántos contar" },
      { href: "/referidos", label: "Programa de referidos", icono: "🤝", desc: "Los empleados recomiendan gente para las búsquedas abiertas" },
    ],
  },
  {
    bloque: GESTION,
    categoria: "Operaciones",
    icono: "🕒",
    items: [
      { href: "/turnos", label: "Turnos", icono: "🔁", desc: "Horarios de trabajo, rotaciones y quién trabaja cada día" },
      { href: "/asistencia", label: "Asistencia", icono: "🗓️", desc: "Calendario de presentes/ausentes, desde fichadas" },
      { href: "/fichadas", label: "Fichadas", icono: "🕒", desc: "Dato crudo de reloj/terminal — auditoría y corrección" },
      { href: "/dispositivos", label: "Dispositivos", icono: "📱", desc: "Terminales de fichada en clientes (admin)" },
    ],
  },
  {
    bloque: GESTION,
    categoria: "Plataforma",
    icono: "🔐",
    items: [
      { href: "/accesos-portal", label: "Accesos al portal", icono: "🔑", desc: "PIN de cada empleado para entrar a /portal" },
      { href: "/accesos-portal/avisos", label: "Avisos enviados", icono: "🔔", desc: "Quién recibe avisos en el celular o por mail, y qué se le mandó" },
      { href: "/usuarios", label: "Usuarios", icono: "🔐", desc: "Altas y a qué empresas entra cada uno, con qué rol", soloAdmin: true },
      { href: "/roles", label: "Roles y permisos", icono: "🛡️", desc: "Qué puede ver y gestionar cada rol, módulo por módulo", soloAdmin: true },
    ],
  },
];

// Un ítem se muestra si el usuario puede abrir esa pantalla. NO hay una
// lista aparte de "qué ve cada rol": se le pregunta a la misma función que
// usa el middleware (puedeAcceder), así el menú nunca ofrece un link que
// después rebota, ni esconde uno que sí funcionaría.
export function menuFiltrado(esAdmin: boolean, permisos: Permisos | null): CategoriaMenu[] {
  return ESTRUCTURA_MENU.map((cat) => ({
    ...cat,
    items: cat.items.filter((i) => puedeAcceder(i.href, "GET", esAdmin, permisos)),
  })).filter((cat) => cat.items.length > 0);
}
