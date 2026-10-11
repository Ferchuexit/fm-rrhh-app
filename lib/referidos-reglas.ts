// FM RRHH — lib/referidos-reglas.ts
// Programa de referidos: un empleado recomienda a alguien para una búsqueda
// abierta. Funciones puras (tests/referidos-reglas.test.mjs).
import { validarPostulacion, type DatosPostulacion } from "./reclutamiento-reglas";

// Tope por persona y por búsqueda: recomendar es poner el nombre propio, no
// repartir el aviso.
export const MAX_REFERIDOS_POR_BUSQUEDA = 5;

export const RELACIONES: Record<string, string> = { trabajo: "Trabajamos juntos antes", estudio: "Estudiamos juntos", familiar: "Es familiar", amigo: "Es amigo o conocido", otro: "Otro" };

export interface DatosReferido { datos: DatosPostulacion; relacion: string }

// `yaReferidos`: cuántos lleva recomendados para esa búsqueda.
export function validarReferido(entrada: any, yaReferidos: number): { referido: DatosReferido | null; error: string | null } {
  const mal = (error: string) => ({ referido: null, error });
  if (yaReferidos >= MAX_REFERIDOS_POR_BUSQUEDA) return mal(`Ya recomendaste a ${MAX_REFERIDOS_POR_BUSQUEDA} personas para esta búsqueda: es el máximo.`);
  const { datos, error } = validarPostulacion(entrada, false);
  if (error) return mal(error.replace("Escribí tu nombre y tu apellido.", "Escribí el nombre y el apellido de la persona."));
  if (!datos.email && !datos.telefono) return mal("Dejanos un teléfono o un mail de la persona, para poder contactarla.");
  const relacion = String(entrada?.relacion ?? "");
  if (!(relacion in RELACIONES)) return mal("Contanos de dónde la conocés.");
  if (!datos.mensaje || datos.mensaje.length < 15) return mal("Contanos en una o dos líneas por qué la recomendás: es lo que más pesa.");
  // No se pasan datos de un tercero sin que lo sepa.
  if (entrada?.consentimiento !== true && entrada?.consentimiento !== "true" && entrada?.consentimiento !== "on") return mal("Antes de recomendarla, avisale: tiene que estar de acuerdo en que nos pases sus datos.");
  return { referido: { datos, relacion }, error: null };
}

// Lo que ve quien refirió: en qué anda su recomendado, sin el detalle
// interno del proceso (ni el motivo si no avanzó).
export function estadoParaReferidor(etapa: string): { clave: "recibido" | "proceso" | "ingreso" | "no"; texto: string } {
  if (etapa === "contratado") return { clave: "ingreso", texto: "¡Ingresó a la empresa!" };
  if (etapa === "descartado") return { clave: "no", texto: "No avanzó esta vez" };
  if (etapa === "postulado") return { clave: "recibido", texto: "Recibido: RR.HH. lo va a revisar" };
  return { clave: "proceso", texto: "En proceso de selección" };
}

interface FilaReferido { referidoPorId: string | null; etapa: string; premioReferidoEn: Date | null; conPremio: boolean }
// Cómo anda el programa: cuántos se recomendaron, cuántos entraron, quiénes
// recomiendan, y qué premios falta entregar.
export function resumenReferidos(filas: FilaReferido[]) {
  const contratados = filas.filter((f) => f.etapa === "contratado");
  const porPersona = new Map<string, { referidos: number; contratados: number }>();
  for (const f of filas) {
    if (!f.referidoPorId) continue;
    const a = porPersona.get(f.referidoPorId) ?? { referidos: 0, contratados: 0 };
    porPersona.set(f.referidoPorId, { referidos: a.referidos + 1, contratados: a.contratados + (f.etapa === "contratado" ? 1 : 0) });
  }
  return {
    total: filas.length, contratados: contratados.length, enProceso: filas.filter((f) => !["contratado", "descartado"].includes(f.etapa)).length,
    efectividad: filas.length ? Math.round((contratados.length / filas.length) * 100) : null,
    premiosPendientes: contratados.filter((f) => f.conPremio && !f.premioReferidoEn).length,
    quienes: [...porPersona].map(([clave, v]) => ({ clave, ...v })).sort((a, b) => b.contratados - a.contratados || b.referidos - a.referidos),
  };
}
