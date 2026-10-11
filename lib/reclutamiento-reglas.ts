// FM RRHH — lib/reclutamiento-reglas.ts
// Puestos, organigrama, búsquedas y candidatos. Funciones puras, sin base
// de datos (tests/reclutamiento-reglas.test.mjs).
import type { Requisito } from "./objetivos-reglas";

// ── Puestos ──────────────────────────────────────────────────────────
export interface DatosPuesto { nombre: string; centroCostoId: string | null; reportaAId: string | null; mision: string | null; tareas: string | null; requisitos: string | null; condiciones: string | null; dotacion: number }

const texto = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max) || null;

export function validarPuesto(entrada: any): { datos: DatosPuesto; error: string | null } {
  const datos: DatosPuesto = {
    nombre: String(entrada?.nombre ?? "").trim().slice(0, 80), centroCostoId: entrada?.centroCostoId ? String(entrada.centroCostoId) : null, reportaAId: entrada?.reportaAId ? String(entrada.reportaAId) : null,
    mision: texto(entrada?.mision, 500), tareas: texto(entrada?.tareas, 2000), requisitos: texto(entrada?.requisitos, 2000), condiciones: texto(entrada?.condiciones, 500), dotacion: Number(entrada?.dotacion ?? 1),
  };
  if (datos.nombre.length < 3) return { datos, error: "Ponele un nombre al puesto (por ejemplo: Operario de seccionadora)." };
  if (!Number.isInteger(datos.dotacion) || datos.dotacion < 0 || datos.dotacion > 500) return { datos, error: "La dotación es cuánta gente debería tener el puesto: un número de 0 a 500." };
  return { datos, error: null };
}

// ¿Poner `reportaAId` como superior de `puestoId` arma un círculo? (A
// depende de B, que depende de A.) `dependencias`: puesto → de quién depende.
export function armaCirculo(puestoId: string | null, reportaAId: string, dependencias: Map<string, string | null>): boolean {
  if (!puestoId) return false; // un puesto nuevo todavía no tiene a nadie abajo
  let actual: string | null = reportaAId;
  for (let pasos = 0; actual && pasos <= dependencias.size; pasos++) {
    if (actual === puestoId) return true;
    actual = dependencias.get(actual) ?? null;
  }
  return false;
}

export interface NodoPuesto { id: string; nombre: string; reportaAId: string | null; dotacion: number; ocupantes: number }
export interface FilaOrganigrama<T> { puesto: T; nivel: number; vacantes: number; aCargo: number }

// El organigrama como lista ordenada para dibujar un árbol: cada puesto
// debajo de su superior, con su nivel. Quien depende de un puesto que ya
// no existe (o quedó en un círculo) va arriba de todo, para no perderlo.
export function organigrama<T extends NodoPuesto>(puestos: T[]): FilaOrganigrama<T>[] {
  const ids = new Set(puestos.map((p) => p.id));
  const hijos = new Map<string | null, T[]>();
  for (const p of [...puestos].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    const padre = p.reportaAId && ids.has(p.reportaAId) ? p.reportaAId : null;
    hijos.set(padre, [...(hijos.get(padre) ?? []), p]);
  }
  const filas: FilaOrganigrama<T>[] = [];
  const vistos = new Set<string>();
  // Cuánta gente tiene por debajo (ocupantes de todos los puestos que dependen, directa o indirectamente).
  const debajo = (id: string, camino = new Set<string>()): number => (hijos.get(id) ?? []).reduce((a, h) => (camino.has(h.id) ? a : a + h.ocupantes + debajo(h.id, new Set([...camino, h.id]))), 0);
  const bajar = (padre: string | null, nivel: number) => {
    for (const p of hijos.get(padre) ?? []) {
      if (vistos.has(p.id)) continue;
      vistos.add(p.id);
      filas.push({ puesto: p, nivel, vacantes: Math.max(0, p.dotacion - p.ocupantes), aCargo: debajo(p.id) });
      bajar(p.id, nivel + 1);
    }
  };
  bajar(null, 0);
  for (const p of puestos) if (!vistos.has(p.id)) { vistos.add(p.id); filas.push({ puesto: p, nivel: 0, vacantes: Math.max(0, p.dotacion - p.ocupantes), aCargo: 0 }); }
  return filas;
}

// ── Búsquedas ────────────────────────────────────────────────────────
export const ESTADOS_BUSQUEDA: Record<string, string> = { borrador: "Borrador", abierta: "Abierta", pausada: "Pausada", cerrada: "Cerrada" };

// Las etapas por las que pasa un candidato, en orden. "contratado" y
// "descartado" son finales.
export const ETAPAS: { clave: string; nombre: string }[] = [
  { clave: "postulado", nombre: "Postulados" },
  { clave: "preseleccion", nombre: "Preselección" },
  { clave: "entrevista", nombre: "Entrevista" },
  { clave: "preocupacional", nombre: "Preocupacional" },
  { clave: "oferta", nombre: "Oferta" },
  { clave: "contratado", nombre: "Contratados" },
  { clave: "descartado", nombre: "Descartados" },
];
export const CLAVES_ETAPA = ETAPAS.map((e) => e.clave);
export const MOTIVOS_DESCARTE: Record<string, string> = { perfil: "No cumple el perfil", pretension: "Pretensión salarial", no_responde: "No respondió", desistio: "Desistió", preocupacional: "No apto en el preocupacional", cubierta: "La vacante se cubrió con otra persona", otro: "Otro" };

// De dónde puede llegar un candidato. El enlace de postulación lleva
// ?f=<clave>, así se sabe qué canal trae gente.
export const FUENTES: Record<string, string> = { web: "Página de empleos", computrabajo: "Computrabajo", bumeran: "Bumeran", zonajobs: "ZonaJobs", linkedin: "LinkedIn", indeed: "Indeed", facebook: "Facebook", whatsapp: "WhatsApp", referido: "Referido", interno: "Postulación interna", manual: "Cargado a mano" };
export const FUENTES_PARA_ENLACE = ["computrabajo", "bumeran", "zonajobs", "linkedin", "indeed", "facebook", "whatsapp", "referido"];
export const fuenteValida = (f: unknown) => (typeof f === "string" && f in FUENTES && f !== "interno" && f !== "manual" ? f : "web");

export interface DatosBusqueda { titulo: string; descripcion: string; requisitos: string | null; ofrecemos: string | null; lugar: string | null; vacantes: number; publica: boolean; interna: boolean; referidos: boolean; premioReferido: string | null }
export function validarBusqueda(entrada: any): { datos: DatosBusqueda; error: string | null } {
  const datos: DatosBusqueda = {
    titulo: String(entrada?.titulo ?? "").trim().slice(0, 100), descripcion: String(entrada?.descripcion ?? "").replace(/\r/g, "").trim().slice(0, 3000),
    requisitos: texto(entrada?.requisitos, 2000), ofrecemos: texto(entrada?.ofrecemos, 1500), lugar: texto(entrada?.lugar, 100),
    vacantes: Number(entrada?.vacantes ?? 1), publica: entrada?.publica !== false, interna: entrada?.interna === true,
    referidos: entrada?.referidos === true, premioReferido: entrada?.referidos === true ? texto(entrada?.premioReferido, 120) : null,
  };
  if (datos.titulo.length < 3) return { datos, error: "Ponele un título a la búsqueda (es lo que lee el candidato)." };
  if (datos.descripcion.length < 20) return { datos, error: "Contá qué va a hacer la persona: es lo primero que mira quien se postula." };
  if (!Number.isInteger(datos.vacantes) || datos.vacantes < 1 || datos.vacantes > 200) return { datos, error: "Las vacantes van de 1 a 200." };
  if (!datos.publica && !datos.interna && !datos.referidos) return { datos, error: "Elegí cómo llegan los candidatos: por la página de empleos, como búsqueda interna, por referidos de los empleados, o varias." };
  return { datos, error: null };
}

// El aviso armado desde el perfil del puesto: punto de partida que RR.HH.
// retoca antes de publicar.
export function avisoDesdePuesto(p: { nombre: string; mision: string | null; tareas: string | null; requisitos: string | null; condiciones: string | null }, sector: string | null): Pick<DatosBusqueda, "titulo" | "descripcion" | "requisitos" | "ofrecemos"> {
  const partes = [p.mision, p.tareas ? `Principales tareas:\n${lineas(p.tareas).map((l) => `• ${l}`).join("\n")}` : null].filter(Boolean);
  return { titulo: p.nombre, descripcion: partes.join("\n\n") || `Buscamos ${p.nombre}${sector ? ` para el sector ${sector}` : ""}.`, requisitos: p.requisitos ? lineas(p.requisitos).map((l) => `• ${l}`).join("\n") : null, ofrecemos: p.condiciones };
}
const lineas = (t: string) => t.split("\n").map((l) => l.replace(/^[\s•\-*]+/, "").trim()).filter(Boolean);

// El texto para pegar en un portal de empleo o en un grupo: todo el aviso
// más el enlace de postulación con la fuente.
export function textoParaPortal(b: { titulo: string; descripcion: string; requisitos: string | null; ofrecemos: string | null; lugar: string | null }, empresa: string, enlace: string): string {
  return [
    `${b.titulo.toUpperCase()}${b.lugar ? ` — ${b.lugar}` : ""}`, empresa, "", b.descripcion,
    ...(b.requisitos ? ["", "REQUISITOS", b.requisitos] : []), ...(b.ofrecemos ? ["", "OFRECEMOS", b.ofrecemos] : []),
    "", `Postulate acá: ${enlace}`,
  ].join("\n");
}

// ── Postulación ──────────────────────────────────────────────────────
export const MAX_CV_BYTES = 4 * 1024 * 1024; // el límite de subida de Vercel es 4,5 MB
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export interface DatosPostulacion { apellido: string; nombre: string; email: string | null; telefono: string | null; localidad: string | null; mensaje: string | null }
// `publica`: viene de afuera → exige consentimiento y un medio de contacto.
export function validarPostulacion(entrada: any, publica: boolean): { datos: DatosPostulacion; error: string | null } {
  const datos: DatosPostulacion = {
    apellido: String(entrada?.apellido ?? "").trim().slice(0, 60), nombre: String(entrada?.nombre ?? "").trim().slice(0, 60),
    email: texto(entrada?.email, 120)?.toLowerCase() ?? null, telefono: texto(entrada?.telefono, 40), localidad: texto(entrada?.localidad, 80), mensaje: texto(entrada?.mensaje, 1500),
  };
  if (datos.nombre.length < 2 || datos.apellido.length < 2) return { datos, error: "Escribí tu nombre y tu apellido." };
  if (datos.email && !EMAIL.test(datos.email)) return { datos, error: "Revisá el mail: no parece una dirección válida." };
  if (datos.telefono && datos.telefono.replace(/\D/g, "").length < 8) return { datos, error: "Revisá el teléfono: poné el número completo, con característica." };
  if (publica) {
    if (!datos.email && !datos.telefono) return { datos, error: "Dejanos un mail o un teléfono para poder contactarte." };
    if (entrada?.consentimiento !== true && entrada?.consentimiento !== "true" && entrada?.consentimiento !== "on") return { datos, error: "Para postularte tenés que aceptar que guardemos tus datos para esta búsqueda." };
  }
  return { datos, error: null };
}

// ¿Se puede pasar un candidato de una etapa a otra? Se puede mover libre
// entre etapas (también hacia atrás: a veces se corrige), pero descartar
// pide motivo y a "contratado" solo se llega si quedan vacantes.
export function motivoNoMover(a: string, motivoDescarte: unknown, contratados: number, vacantes: number, yaContratado: boolean): string | null {
  if (!CLAVES_ETAPA.includes(a)) return "Etapa inválida.";
  if (a === "descartado" && !(typeof motivoDescarte === "string" && motivoDescarte in MOTIVOS_DESCARTE)) return "Elegí por qué se descarta: sirve para no volver a llamarlo por error, o para volver a llamarlo.";
  if (a === "contratado" && !yaContratado && contratados >= vacantes) return `La búsqueda tiene ${vacantes === 1 ? "1 vacante y ya está cubierta" : `${vacantes} vacantes y ya están cubiertas`}. Si entra alguien más, subí las vacantes.`;
  return null;
}

// Cómo viene una búsqueda: cuántos en cada etapa, de dónde llegaron y
// cuántos días lleva abierta (o tardó en cubrirse).
export function resumenBusqueda(b: { abiertaEn: Date | null; cerradaEn: Date | null; vacantes: number }, candidatos: { etapa: string; fuente: string }[], hoy: Date) {
  const porEtapa = Object.fromEntries(CLAVES_ETAPA.map((e) => [e, candidatos.filter((c) => c.etapa === e).length]));
  const fuentes = [...new Set(candidatos.map((c) => c.fuente))].map((f) => ({ fuente: f, nombre: FUENTES[f] ?? f, total: candidatos.filter((c) => c.fuente === f).length, avanzaron: candidatos.filter((c) => c.fuente === f && !["postulado", "descartado"].includes(c.etapa)).length, contratados: candidatos.filter((c) => c.fuente === f && c.etapa === "contratado").length })).sort((x, y) => y.total - x.total);
  const dias = b.abiertaEn ? Math.max(0, Math.round(((b.cerradaEn ?? hoy).getTime() - b.abiertaEn.getTime()) / 86400000)) : null;
  return { total: candidatos.length, porEtapa, enProceso: candidatos.filter((c) => !["contratado", "descartado"].includes(c.etapa)).length, sinRevisar: porEtapa.postulado, cubiertas: Math.min(porEtapa.contratado, b.vacantes), fuentes, dias };
}

export type { Requisito };
