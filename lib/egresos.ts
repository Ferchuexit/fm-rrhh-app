// FM RRHH — lib/egresos.ts
// Lado base de datos del offboarding. Misma mecánica que el onboarding
// (lib/ingresos.ts): plantilla → copia de tareas → las automáticas se
// tildan solas cada vez que se abre una pantalla.
import { prisma } from "./prisma";
import { vencimiento } from "./ingresos-reglas";
import { PLANTILLA_EGRESO_INICIAL, type TareaPlantillaEgreso } from "./egresos-reglas";
export * from "./egresos-reglas";
export { progreso } from "./ingresos-reglas";

export async function plantillasEgresoDe(empresaId: string) {
  const existentes = await prisma.plantillaEgreso.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } });
  if (existentes.length > 0) return existentes;
  try {
    return [await prisma.plantillaEgreso.create({ data: { empresaId, nombre: PLANTILLA_EGRESO_INICIAL.nombre, tareas: PLANTILLA_EGRESO_INICIAL.tareas as any } })];
  } catch {
    return prisma.plantillaEgreso.findMany({ where: { empresaId } }); // otra pestaña la creó recién, o quien mira no puede crearla
  }
}

export function iniciarEgreso(legajoId: string, plantilla: { nombre: string; tareas: unknown }, fechaEgreso: Date, motivo: string, por: string) {
  const tareas = plantilla.tareas as TareaPlantillaEgreso[];
  return prisma.egreso.create({
    data: {
      legajoId, plantilla: plantilla.nombre, fechaEgreso, motivo, iniciadoPor: por,
      tareas: { create: tareas.map((t, orden) => ({ orden, titulo: t.titulo, detalle: t.detalle ?? null, responsable: t.responsable, clave: t.clave ?? null, vence: vencimiento(fechaEgreso, t.dia) })) },
    },
  });
}

// Qué comprobaciones automáticas ya se cumplen para quien se va.
async function clavesCumplidas(egreso: { legajoId: string; entrevistaEn: Date | null }): Promise<Set<string>> {
  const cumplidas = new Set<string>();
  const id = egreso.legajoId;
  const [legajo, aCargo, evaluaciones, objetivos, pedidos] = await Promise.all([
    prisma.legajo.findUnique({ where: { id }, select: { condicion: true, fechaEgreso: true, accesoPortal: { select: { activo: true } } } }),
    prisma.legajo.count({ where: { jefeId: id, condicion: "activo" } }),
    prisma.evaluacion.count({ where: { evaluadorId: id, estado: "pendiente", ciclo: { estado: "abierto" } } }),
    prisma.objetivo.count({ where: { legajoId: id, estado: "en_curso" } }),
    prisma.solicitudAusencia.count({ where: { legajoId: id, estado: "pendiente" } }),
  ]);
  if (!legajo) return cumplidas;
  if (legajo.condicion === "baja" && legajo.fechaEgreso) cumplidas.add("baja_legajo");
  if (!legajo.accesoPortal?.activo) cumplidas.add("portal_cerrado");
  if (aCargo === 0) cumplidas.add("sin_equipo");
  if (evaluaciones === 0) cumplidas.add("sin_evaluaciones");
  if (objetivos === 0) cumplidas.add("objetivos_cerrados");
  if (pedidos === 0) cumplidas.add("sin_pedidos");
  if (egreso.entrevistaEn) cumplidas.add("entrevista");
  return cumplidas;
}

export async function ponerAlDiaEgresos(egresoIds: string[]) {
  if (egresoIds.length === 0) return;
  const egresos = await prisma.egreso.findMany({ where: { id: { in: egresoIds }, estado: "en_curso" }, select: { id: true, legajoId: true, entrevistaEn: true, tareas: { select: { id: true, clave: true, estado: true } } } });
  for (const eg of egresos) {
    try {
      const pendientesAuto = eg.tareas.filter((t) => t.clave && t.estado === "pendiente");
      let quedan = eg.tareas.filter((t) => t.estado === "pendiente").length;
      if (pendientesAuto.length > 0) {
        const cumplidas = await clavesCumplidas(eg);
        const ids = pendientesAuto.filter((t) => cumplidas.has(t.clave!)).map((t) => t.id);
        if (ids.length > 0) {
          await prisma.tareaEgreso.updateMany({ where: { id: { in: ids }, estado: "pendiente" }, data: { estado: "hecha", hechaPor: "sistema", hechaEn: new Date() } });
          quedan -= ids.length;
        }
      }
      if (quedan === 0) await prisma.egreso.updateMany({ where: { id: eg.id, estado: "en_curso" }, data: { estado: "completado", cerradoEn: new Date() } });
    } catch (e) {
      console.error("Offboarding: no se pudo poner al día el egreso", eg.id, e); // no rompe la pantalla
    }
  }
}

// Marca una tarea a mano. `filtro` limita CUÁLES puede tocar quien llama.
export async function marcarTareaEgreso(tareaId: string, estado: "hecha" | "no_aplica" | "pendiente", por: string, filtro: Record<string, unknown> = {}) {
  const { count } = await prisma.tareaEgreso.updateMany({
    where: { id: tareaId, egreso: { estado: "en_curso" }, ...filtro },
    data: estado === "pendiente" ? { estado, hechaPor: null, hechaEn: null } : { estado, hechaPor: por, hechaEn: new Date() },
  });
  if (count === 0) return false;
  const tarea = await prisma.tareaEgreso.findUnique({ where: { id: tareaId }, select: { egresoId: true } });
  if (tarea) await ponerAlDiaEgresos([tarea.egresoId]);
  return true;
}
