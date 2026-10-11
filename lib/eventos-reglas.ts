// FM RRHH — lib/eventos-reglas.ts
// Eventos de la empresa: validar lo que carga RR.HH., decidir si alguien
// todavía puede confirmar, y contar con cuántos hay que contar. Funciones
// puras, sin base de datos (tests/eventos-reglas.test.mjs).
import { fechaDesdeTexto } from "./ausencias-reglas";

export const ESTADOS_EVENTO: Record<string, string> = { borrador: "Borrador", publicado: "Publicado", cancelado: "Cancelado" };
export const MAX_ACOMPANANTES = 10;

// Qué clase de fecha es. "social" es el evento de siempre; las demás son
// fechas de trabajo que se cargan desde la Agenda para que todos las
// tengan presentes.
export const CATEGORIAS_EVENTO: Record<string, { nombre: string; emoji: string }> = {
  social: { nombre: "Evento de la empresa", emoji: "🎉" },
  entrega: { nombre: "Entrega", emoji: "📦" },
  auditoria: { nombre: "Auditoría", emoji: "🔍" },
  reunion: { nombre: "Reunión", emoji: "👥" },
  visita: { nombre: "Visita", emoji: "🤝" },
  mantenimiento: { nombre: "Mantenimiento o parada", emoji: "🛠️" },
  otro: { nombre: "Otra fecha importante", emoji: "📌" },
};
export const esFechaDeTrabajo = (categoria: string) => categoria !== "social";

export interface DatosEvento { categoria: string; titulo: string; descripcion: string | null; lugar: string | null; fecha: Date; hora: string | null; centroCostoIds: string[]; pideConfirmacion: boolean; limiteConfirmar: Date | null; cupo: number | null; maxAcompanantes: number }

const texto = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max) || null;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validarEvento(entrada: any, hoy: Date): { datos: DatosEvento | null; error: string | null } {
  const mal = (error: string) => ({ datos: null, error });
  const titulo = String(entrada?.titulo ?? "").trim().slice(0, 100);
  if (titulo.length < 3) return mal("Ponele un nombre (por ejemplo: Asado de fin de año, o Entrega del pedido de Tigre).");
  const fecha = fechaDesdeTexto(entrada?.fecha);
  if (!fecha) return mal("Elegí qué día es el evento.");
  if (fecha < hoy) return mal("Ese día ya pasó. Elegí una fecha de hoy en adelante.");
  const hora = texto(entrada?.hora, 5);
  if (hora && !HORA.test(hora)) return mal("La hora va como 18:30.");
  const pideConfirmacion = entrada?.pideConfirmacion !== false;
  // Cupo, acompañantes y fecha límite solo tienen sentido si se confirma.
  let limiteConfirmar: Date | null = null, cupo: number | null = null, maxAcompanantes = 0;
  if (pideConfirmacion) {
    if (entrada?.limiteConfirmar) {
      limiteConfirmar = fechaDesdeTexto(entrada.limiteConfirmar);
      if (!limiteConfirmar) return mal("Revisá la fecha límite para confirmar.");
      if (limiteConfirmar > fecha) return mal("La fecha límite para confirmar no puede ser después del evento.");
      if (limiteConfirmar < hoy) return mal("La fecha límite para confirmar ya pasó.");
    }
    if (entrada?.cupo !== undefined && entrada?.cupo !== null && entrada?.cupo !== "") {
      cupo = Number(entrada.cupo);
      if (!Number.isInteger(cupo) || cupo < 1 || cupo > 10000) return mal("El cupo es cuántos lugares hay: un número de 1 a 10.000 (o vacío si no hay tope).");
    }
    maxAcompanantes = Number(entrada?.maxAcompanantes ?? 0);
    if (!Number.isInteger(maxAcompanantes) || maxAcompanantes < 0 || maxAcompanantes > MAX_ACOMPANANTES) return mal(`Los acompañantes por persona van de 0 a ${MAX_ACOMPANANTES}.`);
  }
  const centroCostoIds = [...new Set<string>((Array.isArray(entrada?.centroCostoIds) ? entrada.centroCostoIds : []).map(String))];
  const categoria = typeof entrada?.categoria === "string" && entrada.categoria in CATEGORIAS_EVENTO ? entrada.categoria : "social";
  return { datos: { categoria, titulo, descripcion: texto(entrada?.descripcion, 1500), lugar: texto(entrada?.lugar, 150), fecha, hora, centroCostoIds, pideConfirmacion, limiteConfirmar, cupo, maxAcompanantes }, error: null };
}

type EventoParaResponder = { estado: string; fecha: Date; pideConfirmacion: boolean; limiteConfirmar: Date | null; cupo: number | null; maxAcompanantes: number };

// ¿A esta persona le corresponde el evento? (Vacío = toda la empresa.)
export const leCorresponde = (e: { centroCostoIds: string[] }, centroCostoId: string | null) => e.centroCostoIds.length === 0 || (centroCostoId !== null && e.centroCostoIds.includes(centroCostoId));

// Hasta qué día se puede confirmar.
export const ultimoDiaParaConfirmar = (e: { fecha: Date; limiteConfirmar: Date | null }) => e.limiteConfirmar ?? e.fecha;

// Por qué NO se puede responder (o null si se puede).
export function motivoNoResponder(e: EventoParaResponder, hoy: Date): string | null {
  if (e.estado === "cancelado") return "Este evento se canceló.";
  if (e.estado !== "publicado") return "Este evento no está publicado.";
  if (!e.pideConfirmacion) return "Este evento no necesita confirmación.";
  if (e.fecha < hoy) return "Este evento ya pasó.";
  if (ultimoDiaParaConfirmar(e) < hoy) return "Ya pasó la fecha para confirmar. Si igual querés ir, avisale a RR.HH.";
  return null;
}

export interface Respuesta { va: boolean; acompanantes: number }
// Lugares que ocupa una respuesta: la persona más los que lleva.
const lugares = (r: Respuesta) => (r.va ? 1 + r.acompanantes : 0);
export const lugaresOcupados = (respuestas: Respuesta[]) => respuestas.reduce((a, r) => a + lugares(r), 0);

// Valida la respuesta de una persona. `otras`: las respuestas de los DEMÁS
// (sin la suya anterior, si ya había respondido: cambiar de opinión no
// tiene que chocar contra su propio lugar).
export function validarRespuesta(entrada: any, e: EventoParaResponder, otras: Respuesta[], hoy: Date): { respuesta: Respuesta | null; error: string | null } {
  const motivo = motivoNoResponder(e, hoy);
  if (motivo) return { respuesta: null, error: motivo };
  if (typeof entrada?.va !== "boolean") return { respuesta: null, error: "Decinos si vas o no." };
  const acompanantes = entrada.va ? Number(entrada?.acompanantes ?? 0) : 0;
  if (!Number.isInteger(acompanantes) || acompanantes < 0) return { respuesta: null, error: "Revisá cuántos acompañantes llevás." };
  if (acompanantes > e.maxAcompanantes) return { respuesta: null, error: e.maxAcompanantes === 0 ? "Este evento es sin acompañantes." : `Podés llevar hasta ${e.maxAcompanantes} ${e.maxAcompanantes === 1 ? "acompañante" : "acompañantes"}.` };
  const respuesta = { va: entrada.va, acompanantes };
  if (e.cupo !== null && respuesta.va) {
    const quedan = e.cupo - lugaresOcupados(otras);
    if (quedan <= 0) return { respuesta: null, error: "Ya no quedan lugares. Si se libera alguno, vas a poder anotarte." };
    if (lugares(respuesta) > quedan) return { respuesta: null, error: `Solo ${quedan === 1 ? "queda 1 lugar" : `quedan ${quedan} lugares`}: probá con menos acompañantes.` };
  }
  return { respuesta, error: null };
}

// Con cuántos contar. `invitados`: a cuántos les corresponde el evento.
export function resumenEvento(respuestas: (Respuesta & { asistio?: boolean | null })[], invitados: number, cupo: number | null) {
  const van = respuestas.filter((r) => r.va);
  const acompanantes = van.reduce((a, r) => a + r.acompanantes, 0);
  const tomada = respuestas.some((r) => r.asistio !== null && r.asistio !== undefined);
  return {
    van: van.length, noVan: respuestas.length - van.length, acompanantes, total: van.length + acompanantes,
    sinResponder: Math.max(0, invitados - respuestas.length),
    quedan: cupo === null ? null : Math.max(0, cupo - van.length - acompanantes),
    // Si se tomó asistencia: cuántos de los que dijeron que iban, fueron.
    asistieron: tomada ? respuestas.filter((r) => r.asistio === true).length : null,
  };
}

// "sábado 12 de diciembre, 18:30 hs" — para el portal y los avisos.
export function cuandoEs(e: { fecha: Date; hora: string | null }): string {
  const dia = e.fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return e.hora ? `${dia}, ${e.hora} hs` : dia;
}
