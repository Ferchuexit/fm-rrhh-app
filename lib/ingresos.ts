// FM RRHH — lib/ingresos.ts
// Lado base de datos del onboarding.
import { prisma } from "./prisma";
import { cargarLegajoDigital } from "./legajo-digital";
import { PLANTILLA_INICIAL, vencimiento, type TareaPlantilla } from "./ingresos-reglas";
export * from "./ingresos-reglas";

// La primera vez que una empresa abre Onboarding se le crea la plantilla de
// partida, para que no arranque con la pantalla vacía.
export async function plantillasDeEmpresa(empresaId: string) {
  const existentes = await prisma.plantillaIngreso.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } });
  if (existentes.length > 0) return existentes;
  try {
    return [await prisma.plantillaIngreso.create({ data: { empresaId, nombre: PLANTILLA_INICIAL.nombre, tareas: PLANTILLA_INICIAL.tareas as any } })];
  } catch {
    return prisma.plantillaIngreso.findMany({ where: { empresaId } }); // otra pestaña la creó recién, o quien mira no puede crearla
  }
}

export async function iniciarIngreso(legajoId: string, plantilla: { nombre: string; tareas: unknown }, por: string) {
  const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: legajoId }, select: { fechaIngreso: true } });
  const tareas = plantilla.tareas as TareaPlantilla[];
  return prisma.ingreso.create({
    data: {
      legajoId, plantilla: plantilla.nombre, fechaIngreso: legajo.fechaIngreso, iniciadoPor: por,
      tareas: { create: tareas.map((t, orden) => ({ orden, titulo: t.titulo, detalle: t.detalle ?? null, responsable: t.responsable, clave: t.clave ?? null, vence: vencimiento(legajo.fechaIngreso, t.dia) })) },
    },
  });
}

// Qué claves automáticas ya se cumplen para un legajo.
async function clavesCumplidas(legajoId: string, hacenFalta: Set<string>): Promise<Set<string>> {
  const cumplidas = new Set<string>();
  const legajo = await prisma.legajo.findUnique({
    where: { id: legajoId },
    select: { jefeId: true, cbu: true, obraSocialId: true, accesoPortal: { select: { activo: true, debeCambiarPin: true } }, _count: { select: { asignacionesHorario: true } } },
  });
  if (!legajo) return cumplidas;
  if (legajo.jefeId) cumplidas.add("jefe");
  if (legajo._count.asignacionesHorario > 0) cumplidas.add("horario");
  if (legajo.accesoPortal?.activo) cumplidas.add("acceso_portal");
  if (legajo.accesoPortal?.activo && !legajo.accesoPortal.debeCambiarPin) cumplidas.add("pin_propio");
  if (legajo.cbu) cumplidas.add("cbu");
  if (legajo.obraSocialId) cumplidas.add("obra_social");
  if (hacenFalta.has("legajo_empleado") || hacenFalta.has("legajo_completo")) {
    const { resumen } = await cargarLegajoDigital(legajoId);
    if (resumen.pendientesEmpleado === 0) cumplidas.add("legajo_empleado");
    if (resumen.completo) cumplidas.add("legajo_completo");
  }
  return cumplidas;
}

// Tilda las tareas automáticas que ya se cumplen y cierra los ingresos que
// quedaron sin pendientes. Se llama al abrir cualquier pantalla de
// onboarding: así el estado siempre refleja lo que hay cargado HOY, sin
// tener que enganchar cada pantalla del sistema.
export async function ponerAlDia(ingresoIds: string[]) {
  if (ingresoIds.length === 0) return;
  const ingresos = await prisma.ingreso.findMany({ where: { id: { in: ingresoIds }, estado: "en_curso" }, select: { id: true, legajoId: true, tareas: { select: { id: true, clave: true, estado: true } } } });
  for (const ing of ingresos) {
    try {
      const pendientesAuto = ing.tareas.filter((t) => t.clave && t.estado === "pendiente");
      let quedan = ing.tareas.filter((t) => t.estado === "pendiente").length;
      if (pendientesAuto.length > 0) {
        const cumplidas = await clavesCumplidas(ing.legajoId, new Set(pendientesAuto.map((t) => t.clave!)));
        const ids = pendientesAuto.filter((t) => cumplidas.has(t.clave!)).map((t) => t.id);
        if (ids.length > 0) {
          await prisma.tareaIngreso.updateMany({ where: { id: { in: ids }, estado: "pendiente" }, data: { estado: "hecha", hechaPor: "sistema", hechaEn: new Date() } });
          quedan -= ids.length;
        }
      }
      if (quedan === 0) await prisma.ingreso.updateMany({ where: { id: ing.id, estado: "en_curso" }, data: { estado: "completado", cerradoEn: new Date() } });
    } catch (e) {
      console.error("Onboarding: no se pudo poner al día el ingreso", ing.id, e); // no rompe la pantalla
    }
  }
}

// Marca una tarea a mano. `filtro` limita CUÁLES puede tocar quien llama
// (el portal lo usa para "solo las mías" / "solo las de mi equipo").
export async function marcarTarea(tareaId: string, estado: "hecha" | "no_aplica" | "pendiente", por: string, nota: string | null, filtro: Record<string, unknown> = {}) {
  const { count } = await prisma.tareaIngreso.updateMany({
    where: { id: tareaId, ingreso: { estado: "en_curso" }, ...filtro },
    data: estado === "pendiente" ? { estado, hechaPor: null, hechaEn: null, nota } : { estado, hechaPor: por, hechaEn: new Date(), nota },
  });
  if (count === 0) return false;
  const tarea = await prisma.tareaIngreso.findUnique({ where: { id: tareaId }, select: { ingresoId: true } });
  if (tarea) await ponerAlDia([tarea.ingresoId]);
  return true;
}
