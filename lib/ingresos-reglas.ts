// FM RRHH — lib/ingresos-reglas.ts
// Onboarding: los pasos de ingreso de un empleado nuevo. Funciones puras,
// sin base de datos (tests/ingresos-reglas.test.mjs).

export type Responsable = "rrhh" | "jefe" | "empleado";
export const RESPONSABLES: Record<Responsable, string> = { rrhh: "RR.HH.", jefe: "Jefe directo", empleado: "El empleado" };

// Tareas que el sistema puede comprobar solo, mirando sus propios datos.
// Cuando la condición se cumple, la tarea se tilda sin que nadie la toque.
export const CLAVES_AUTOMATICAS: Record<string, string> = {
  jefe: "tiene cargado a quién reporta",
  horario: "tiene un horario asignado en Turnos",
  acceso_portal: "tiene acceso al portal generado",
  pin_propio: "entró al portal y eligió su PIN",
  legajo_empleado: "no le queda nada por subir ni firmar en su legajo",
  legajo_completo: "el legajo digital está completo",
  cbu: "tiene el CBU cargado en el legajo",
  obra_social: "tiene la obra social cargada en el legajo",
};

export interface TareaPlantilla { titulo: string; detalle?: string; responsable: Responsable; dia: number; clave?: string }

const DIA_MS = 24 * 3600 * 1000;
export const MAX_TAREAS = 60;

// La que se crea sola la primera vez que una empresa abre Onboarding. Es un
// punto de partida para una planta industrial: cada empresa la edita.
export const PLANTILLA_INICIAL: { nombre: string; tareas: TareaPlantilla[] } = {
  nombre: "Ingreso general",
  tareas: [
    { dia: -2, responsable: "rrhh", titulo: "Alta temprana en ARCA", detalle: "Tiene que estar hecha antes de que empiece a trabajar. Subí la constancia al legajo digital." },
    { dia: -2, responsable: "rrhh", titulo: "Examen preocupacional", detalle: "Con el resultado antes del ingreso." },
    { dia: -1, responsable: "rrhh", titulo: "Cargar a quién reporta", clave: "jefe" },
    { dia: -1, responsable: "rrhh", titulo: "Asignar el horario de trabajo", clave: "horario" },
    { dia: -1, responsable: "rrhh", titulo: "Preparar ropa de trabajo y elementos de protección", detalle: "Según los talles cargados en el legajo." },
    { dia: 0, responsable: "rrhh", titulo: "Generar el acceso al portal y entregarle el PIN", clave: "acceso_portal" },
    { dia: 0, responsable: "rrhh", titulo: "Entregar ropa de trabajo y EPP, con constancia firmada" },
    { dia: 0, responsable: "rrhh", titulo: "Entregar el reglamento interno y hacerlo firmar" },
    { dia: 0, responsable: "jefe", titulo: "Recibirlo y presentarlo al equipo" },
    { dia: 0, responsable: "jefe", titulo: "Recorrida por el sector e inducción de seguridad", detalle: "Riesgos del puesto, salidas de emergencia y uso de los elementos de protección." },
    { dia: 0, responsable: "empleado", titulo: "Entrar al portal y elegir tu PIN", clave: "pin_propio" },
    { dia: 3, responsable: "empleado", titulo: "Completar tu legajo", detalle: "Subí la foto del DNI y la constancia de CUIL, y firmá la ficha de datos.", clave: "legajo_empleado" },
    { dia: 5, responsable: "rrhh", titulo: "Registrar la cuenta sueldo (CBU)", clave: "cbu" },
    { dia: 5, responsable: "rrhh", titulo: "Confirmar la obra social", clave: "obra_social" },
    { dia: 5, responsable: "jefe", titulo: "Capacitación en el puesto", detalle: "Tareas, máquinas y procedimientos que va a usar." },
    { dia: 30, responsable: "jefe", titulo: "Charla de seguimiento del primer mes" },
    { dia: 30, responsable: "rrhh", titulo: "Verificar que el legajo digital esté completo", clave: "legajo_completo" },
    { dia: 150, responsable: "jefe", titulo: "Evaluación antes de que termine el período de prueba", detalle: "Definir con RR.HH. si continúa. Ajustá el día según el período de prueba que le corresponda a la empresa." },
  ],
};

// Lo que llega del editor de plantillas → tareas válidas, ordenadas por día.
export function limpiarTareas(entrada: unknown): { tareas: TareaPlantilla[]; error: string | null } {
  if (!Array.isArray(entrada) || entrada.length === 0) return { tareas: [], error: "La plantilla necesita al menos una tarea." };
  if (entrada.length > MAX_TAREAS) return { tareas: [], error: `Una plantilla puede tener hasta ${MAX_TAREAS} tareas.` };
  const tareas: TareaPlantilla[] = [];
  for (const [i, t] of entrada.entries()) {
    const titulo = String(t?.titulo ?? "").trim().slice(0, 120);
    if (titulo.length < 3) return { tareas: [], error: `A la tarea ${i + 1} le falta el título.` };
    if (!(t?.responsable in RESPONSABLES)) return { tareas: [], error: `Elegí quién hace "${titulo}".` };
    const dia = Number(t?.dia);
    if (!Number.isInteger(dia) || dia < -60 || dia > 730) return { tareas: [], error: `Revisá el día de "${titulo}": es un número entre -60 (antes del ingreso) y 730.` };
    const detalle = String(t?.detalle ?? "").trim().slice(0, 300);
    const clave = typeof t?.clave === "string" && t.clave in CLAVES_AUTOMATICAS ? t.clave : undefined;
    tareas.push({ titulo, responsable: t.responsable, dia, ...(detalle ? { detalle } : {}), ...(clave ? { clave } : {}) });
  }
  // Orden estable: por día, y dentro del día como las cargaron.
  return { tareas: tareas.map((t, i) => ({ t, i })).sort((a, b) => a.t.dia - b.t.dia || a.i - b.i).map((x) => x.t), error: null };
}

export const vencimiento = (fechaIngreso: Date, dia: number) => new Date(fechaIngreso.getTime() + dia * DIA_MS);

// En qué momento del ingreso cae una tarea — para agruparlas en pantalla.
export const ETAPAS = ["Antes del ingreso", "Primer día", "Primera semana", "Primer mes", "Después"] as const;
export function etapaDe(fechaIngreso: Date, vence: Date): (typeof ETAPAS)[number] {
  const dia = Math.round((vence.getTime() - fechaIngreso.getTime()) / DIA_MS);
  return dia < 0 ? ETAPAS[0] : dia === 0 ? ETAPAS[1] : dia <= 7 ? ETAPAS[2] : dia <= 30 ? ETAPAS[3] : ETAPAS[4];
}

export interface EstadoTarea { estado: string; vence: Date; responsable: string }

// Cómo viene un ingreso. "No aplica" cuenta como resuelta.
export function progreso(tareas: EstadoTarea[], hoy: Date) {
  const resueltas = tareas.filter((t) => t.estado !== "pendiente").length;
  const pendientes = tareas.filter((t) => t.estado === "pendiente");
  const vencidas = pendientes.filter((t) => t.vence < hoy);
  return {
    total: tareas.length,
    resueltas,
    porcentaje: tareas.length ? Math.round((resueltas / tareas.length) * 100) : 100,
    vencidas: vencidas.length,
    vencidasDe: { rrhh: vencidas.filter((t) => t.responsable === "rrhh").length, jefe: vencidas.filter((t) => t.responsable === "jefe").length, empleado: vencidas.filter((t) => t.responsable === "empleado").length },
    completo: pendientes.length === 0,
  };
}

// ¿Puede esta persona tildar esta tarea a mano? RR.HH. puede todas (también
// las automáticas: a veces la realidad va por delante del sistema). El jefe
// y el empleado, solo las suyas y solo las que no se comprueban solas.
export function puedeMarcar(quien: Responsable, tarea: { responsable: string; clave: string | null }): boolean {
  if (quien === "rrhh") return true;
  return tarea.responsable === quien && !tarea.clave;
}
