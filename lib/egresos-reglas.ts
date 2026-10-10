// FM RRHH — lib/egresos-reglas.ts
// Offboarding: los pasos de salida de quien deja la empresa y la entrevista
// de salida. Funciones puras, sin base de datos
// (tests/egresos-reglas.test.mjs). Comparte con el onboarding el cálculo de
// avance y vencimientos (lib/ingresos-reglas.ts).

export type ResponsableEgreso = "rrhh" | "jefe";
export const RESPONSABLES_EGRESO: Record<ResponsableEgreso, string> = { rrhh: "RR.HH.", jefe: "Jefe directo" };

// Cómo termina la relación (lo formal).
export const MOTIVOS_EGRESO: Record<string, string> = {
  renuncia: "Renuncia",
  despido_sin_causa: "Despido sin causa",
  despido_con_causa: "Despido con causa",
  fin_contrato: "Fin de contrato o de período de prueba",
  mutuo_acuerdo: "Mutuo acuerdo",
  jubilacion: "Jubilación",
  fallecimiento: "Fallecimiento",
  otro: "Otro",
};
// Los motivos en que la persona decidió irse: son los que explican la
// rotación que la empresa podría haber evitado.
export const MOTIVOS_VOLUNTARIOS = ["renuncia", "mutuo_acuerdo"];

// Por qué se va de verdad (lo que sale de la entrevista de salida).
export const MOTIVOS_ENTREVISTA: Record<string, string> = {
  sueldo: "Mejor sueldo en otro lado",
  crecimiento: "Falta de crecimiento o capacitación",
  jefe: "Relación con el jefe",
  clima: "Clima de trabajo o compañeros",
  horarios: "Horarios o turnos",
  distancia: "Distancia o viaje",
  condiciones: "Condiciones de trabajo o seguridad",
  personal: "Motivos personales o familiares",
  otro: "Otro",
};
export const RECONTRATABLE: Record<string, string> = { si: "Sí", con_reservas: "Con reservas", no: "No" };

// Tareas que el sistema comprueba solo, mirando sus propios datos.
export const CLAVES_EGRESO: Record<string, string> = {
  baja_legajo: "el legajo figura dado de baja, con su fecha",
  portal_cerrado: "ya no tiene acceso al portal",
  sin_equipo: "no le queda gente a cargo (se reasignó a otro jefe)",
  sin_evaluaciones: "no le quedan evaluaciones de su equipo por completar",
  objetivos_cerrados: "no le quedan objetivos en curso",
  sin_pedidos: "no le quedan pedidos de vacaciones o permisos sin responder",
  entrevista: "se cargó la entrevista de salida",
};

export interface TareaPlantillaEgreso { titulo: string; detalle?: string; responsable: ResponsableEgreso; dia: number; clave?: string }
export const MAX_TAREAS_EGRESO = 60;

// Punto de partida para una planta industrial; cada empresa la edita. Los
// días son una sugerencia de orden, NO plazos legales: esos los define la
// ley vigente y el convenio.
export const PLANTILLA_EGRESO_INICIAL: { nombre: string; tareas: TareaPlantillaEgreso[] } = {
  nombre: "Egreso general",
  tareas: [
    { dia: -5, responsable: "rrhh", titulo: "Archivar la comunicación de la salida", detalle: "Telegrama de renuncia, carta documento o acuerdo firmado, según el caso. Subilo al legajo digital." },
    { dia: -3, responsable: "rrhh", titulo: "Reasignar a la gente que tenía a cargo", clave: "sin_equipo" },
    { dia: -3, responsable: "rrhh", titulo: "Reasignar o cerrar las evaluaciones que tenía que completar", clave: "sin_evaluaciones" },
    { dia: -3, responsable: "jefe", titulo: "Traspaso de tareas", detalle: "Qué queda pendiente, a quién se lo pasa y dónde está la información." },
    { dia: -1, responsable: "rrhh", titulo: "Responder los pedidos de vacaciones o permisos pendientes", clave: "sin_pedidos" },
    { dia: -1, responsable: "rrhh", titulo: "Cerrar o cancelar sus objetivos", clave: "objetivos_cerrados" },
    { dia: 0, responsable: "rrhh", titulo: "Entrevista de salida", detalle: "Por qué se va y qué mejoraría. Se carga en esta misma pantalla.", clave: "entrevista" },
    { dia: 0, responsable: "jefe", titulo: "Recibir herramientas, llaves y equipos a su cargo" },
    { dia: 0, responsable: "rrhh", titulo: "Recibir ropa de trabajo, EPP y credencial", detalle: "Con constancia firmada de lo que devuelve." },
    { dia: 0, responsable: "rrhh", titulo: "Dar de baja el legajo en el sistema", detalle: "En Legajos: condición «Baja», con la fecha y el motivo.", clave: "baja_legajo" },
    { dia: 0, responsable: "rrhh", titulo: "Quitarlo de las terminales de fichada y de los accesos a planta" },
    { dia: 1, responsable: "rrhh", titulo: "Baja en ARCA", detalle: "Verificá el plazo vigente. Subí la constancia al legajo digital." },
    { dia: 1, responsable: "rrhh", titulo: "Examen médico de egreso", detalle: "Si la empresa lo hace." },
    { dia: 3, responsable: "rrhh", titulo: "Liquidación final", detalle: "Verificá el plazo legal de pago vigente. El recibo lo firma desde el portal." },
    { dia: 10, responsable: "rrhh", titulo: "Entregar certificados de trabajo y de aportes", detalle: "Con constancia de entrega." },
    { dia: 30, responsable: "rrhh", titulo: "Cerrar su acceso al portal", detalle: "Dejalo abierto mientras tenga recibos para firmar; después, desactivalo en Accesos al portal.", clave: "portal_cerrado" },
  ],
};

export function limpiarTareasEgreso(entrada: unknown): { tareas: TareaPlantillaEgreso[]; error: string | null } {
  if (!Array.isArray(entrada) || entrada.length === 0) return { tareas: [], error: "La plantilla necesita al menos una tarea." };
  if (entrada.length > MAX_TAREAS_EGRESO) return { tareas: [], error: `Una plantilla puede tener hasta ${MAX_TAREAS_EGRESO} tareas.` };
  const tareas: TareaPlantillaEgreso[] = [];
  for (const [i, t] of entrada.entries()) {
    const titulo = String(t?.titulo ?? "").trim().slice(0, 120);
    if (titulo.length < 3) return { tareas: [], error: `A la tarea ${i + 1} le falta el título.` };
    if (!(t?.responsable in RESPONSABLES_EGRESO)) return { tareas: [], error: `Elegí quién hace "${titulo}".` };
    const dia = Number(t?.dia);
    if (!Number.isInteger(dia) || dia < -90 || dia > 365) return { tareas: [], error: `Revisá el día de "${titulo}": es un número entre -90 (antes del último día) y 365.` };
    const detalle = String(t?.detalle ?? "").trim().slice(0, 300);
    const clave = typeof t?.clave === "string" && t.clave in CLAVES_EGRESO ? t.clave : undefined;
    tareas.push({ titulo, responsable: t.responsable, dia, ...(detalle ? { detalle } : {}), ...(clave ? { clave } : {}) });
  }
  return { tareas: tareas.map((t, i) => ({ t, i })).sort((a, b) => a.t.dia - b.t.dia || a.i - b.i).map((x) => x.t), error: null };
}

export const ETAPAS_EGRESO = ["Antes del último día", "Último día", "Después"] as const;
export function etapaEgreso(fechaEgreso: Date, vence: Date): (typeof ETAPAS_EGRESO)[number] {
  const dia = Math.round((vence.getTime() - fechaEgreso.getTime()) / 86400000);
  return dia < 0 ? ETAPAS_EGRESO[0] : dia === 0 ? ETAPAS_EGRESO[1] : ETAPAS_EGRESO[2];
}

// Para iniciar un egreso: motivo conocido y una fecha razonable (se puede
// cargar uno que ya pasó, para dejar el registro, pero no de hace años ni
// a más de 6 meses).
export function validarInicio(motivo: unknown, fechaEgreso: Date | null, hoy: Date): string | null {
  if (typeof motivo !== "string" || !(motivo in MOTIVOS_EGRESO)) return "Elegí el motivo de la salida.";
  if (!fechaEgreso) return "Poné cuál es el último día de trabajo.";
  const dias = Math.round((fechaEgreso.getTime() - hoy.getTime()) / 86400000);
  if (dias < -365) return "Ese último día es de hace más de un año: revisá la fecha.";
  if (dias > 183) return "Ese último día es a más de 6 meses: revisá la fecha.";
  return null;
}

export function validarEntrevista(entrada: any): { datos: { entrevistaMotivo: string; recontratable: string; entrevistaComentario: string | null }; error: string | null } {
  const datos = { entrevistaMotivo: String(entrada?.entrevistaMotivo ?? ""), recontratable: String(entrada?.recontratable ?? ""), entrevistaComentario: String(entrada?.entrevistaComentario ?? "").trim().slice(0, 2000) || null };
  if (!(datos.entrevistaMotivo in MOTIVOS_ENTREVISTA)) return { datos, error: "Elegí el motivo principal por el que se va." };
  if (!(datos.recontratable in RECONTRATABLE)) return { datos, error: "Indicá si la empresa lo volvería a tomar." };
  if (datos.entrevistaMotivo === "otro" && !datos.entrevistaComentario) return { datos, error: "Si el motivo es «Otro», contalo en el comentario." };
  return { datos, error: null };
}

// Rotación: de los egresos de un período, cuántos, por qué (formal y real)
// y cuántos fueron decisión de la persona. Los cancelados no cuentan.
export function resumenRotacion(egresos: { estado: string; motivo: string; entrevistaMotivo: string | null; recontratable: string | null }[]) {
  const validos = egresos.filter((e) => e.estado !== "cancelado");
  const contar = (valores: (string | null)[], nombres: Record<string, string>) =>
    Object.entries(valores.reduce<Record<string, number>>((acc, v) => (v ? { ...acc, [v]: (acc[v] ?? 0) + 1 } : acc), {}))
      .map(([clave, cantidad]) => ({ clave, nombre: nombres[clave] ?? clave, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  const conEntrevista = validos.filter((e) => e.entrevistaMotivo);
  return {
    total: validos.length,
    voluntarios: validos.filter((e) => MOTIVOS_VOLUNTARIOS.includes(e.motivo)).length,
    porMotivo: contar(validos.map((e) => e.motivo), MOTIVOS_EGRESO),
    conEntrevista: conEntrevista.length,
    porMotivoReal: contar(conEntrevista.map((e) => e.entrevistaMotivo), MOTIVOS_ENTREVISTA),
    recontratables: conEntrevista.filter((e) => e.recontratable === "si").length,
  };
}
