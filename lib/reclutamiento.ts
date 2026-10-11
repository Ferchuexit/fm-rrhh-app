// FM RRHH — lib/reclutamiento.ts
// Lado base de datos de las búsquedas y los candidatos.
import { prisma, prismaSistema } from "./prisma";
import { guardarEnCarpeta, mimeReal } from "./almacen-documentos";
import { MAX_CV_BYTES, type DatosPostulacion } from "./reclutamiento-reglas";
import { evaluar, type PreguntaFiltro, type RespuestasFiltro } from "./reclutamiento-filtros";
export * from "./reclutamiento-reglas";
export * from "./reclutamiento-filtros";
export * from "./referidos-reglas";

export const MAX_CANDIDATOS_POR_BUSQUEDA = 1000;

// Lo que se puede mostrar de un candidato en el panel: todo menos el
// archivo del CV (que se baja aparte).
export const CAMPOS_CANDIDATO = { id: true, busquedaId: true, apellido: true, nombre: true, email: true, telefono: true, localidad: true, mensaje: true, fuente: true, empleadoId: true, referidoPorId: true, referidoPorNombre: true, relacionReferido: true, premioReferidoEn: true, cvNombre: true, respuestas: true, puntajeFiltro: true, cumpleExcluyentes: true, noCumple: true, palabrasHalladas: true, etapa: true, etapaDesde: true, motivoDescarte: true, puntaje: true, notas: true, createdAt: true } as const;

// El CV: solo PDF de verdad (se miran los primeros bytes, no la extensión)
// y hasta 4 MB. Devuelve los campos a guardar, o el motivo del rechazo.
export interface CVGuardado { cvNombre: string | null; cvKey: string | null; cvBase64: string | null; cvTexto: string | null }
export async function prepararCV(archivo: File | null, busquedaId: string): Promise<{ error: string } | CVGuardado> {
  if (!archivo || archivo.size === 0) return { cvNombre: null, cvKey: null, cvBase64: null, cvTexto: null };
  if (archivo.size > MAX_CV_BYTES) return { error: "El CV pesa más de 4 MB. Probá con un PDF más liviano." };
  const buffer = Buffer.from(await archivo.arrayBuffer());
  if (mimeReal(buffer) !== "application/pdf") return { error: "El CV tiene que ser un archivo PDF." };
  const g = await guardarEnCarpeta(`candidatos/${busquedaId}`, archivo.name || "cv.pdf", buffer, "application/pdf");
  return { cvNombre: (archivo.name || "cv.pdf").replace(/[^\w.\- ]+/g, "_").slice(-80), cvKey: g.storageKey, cvBase64: g.contenidoBase64, cvTexto: await textoDelPDF(buffer) };
}

// El texto del CV, para buscar las palabras clave de la búsqueda. Si el PDF
// es una foto escaneada (sin texto) o no se puede leer, devuelve null y el
// candidato simplemente no suma por palabras clave: nunca hace fallar la
// postulación.
export async function textoDelPDF(buffer: Buffer): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(buffer)), { mergePages: true });
    const limpio = String(text ?? "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
    return limpio.length >= 20 ? limpio.slice(0, 20000) : null;
  } catch (e) {
    console.error("Reclutamiento: no se pudo leer el texto de un CV:", (e as Error)?.message);
    return null;
  }
}

export interface FiltrosDeBusqueda { preguntas: PreguntaFiltro[]; palabras: string[] }
export const filtrosDe = (b: { preguntas: unknown; palabrasClave: string[] }): FiltrosDeBusqueda => ({ preguntas: (Array.isArray(b.preguntas) ? b.preguntas : []) as PreguntaFiltro[], palabras: b.palabrasClave });

// Vuelve a calcular el puntaje de todos los candidatos de una búsqueda
// (cuando cambian las palabras clave).
export async function recalcularFiltros(busquedaId: string, filtros: FiltrosDeBusqueda) {
  const candidatos = await prisma.candidato.findMany({ where: { busquedaId }, select: { id: true, respuestas: true, cvTexto: true, mensaje: true } });
  for (const c of candidatos) {
    await prisma.candidato.update({ where: { id: c.id }, data: evaluar(filtros.preguntas, filtros.palabras, c.respuestas as RespuestasFiltro | null, [c.cvTexto, c.mensaje].filter(Boolean).join(" ") || null) });
  }
}

// Guarda una postulación. `db`: el cliente a usar — la página pública no
// tiene sesión y usa el del sistema; el panel, el suyo.
// Si la misma persona (mismo mail o teléfono) ya se postuló a ESA
// búsqueda, no se duplica.
export async function registrarPostulacion(db: typeof prisma | typeof prismaSistema, busquedaId: string, datos: DatosPostulacion, extra: { fuente: string; empleadoId?: string | null; referido?: { porId: string; porNombre: string; relacion: string }; cv?: CVGuardado; consentimiento?: boolean; filtros?: FiltrosDeBusqueda; respuestas?: RespuestasFiltro }): Promise<"creada" | "repetida" | "llena"> {
  const mismos = [...(datos.email ? [{ email: datos.email }] : []), ...(datos.telefono ? [{ telefono: datos.telefono }] : []), ...(extra.empleadoId ? [{ empleadoId: extra.empleadoId }] : [])];
  if (mismos.length > 0 && (await (db as typeof prisma).candidato.count({ where: { busquedaId, OR: mismos } })) > 0) return "repetida";
  if ((await (db as typeof prisma).candidato.count({ where: { busquedaId } })) >= MAX_CANDIDATOS_POR_BUSQUEDA) return "llena";
  // El puntaje del filtro: respuestas + palabras clave buscadas en el CV y
  // en lo que escribió.
  const resultado = extra.filtros ? evaluar(extra.filtros.preguntas, extra.filtros.palabras, extra.respuestas ?? null, [extra.cv?.cvTexto, datos.mensaje].filter(Boolean).join(" ") || null) : {};
  await (db as typeof prisma).candidato.create({ data: { busquedaId, ...datos, fuente: extra.fuente, empleadoId: extra.empleadoId ?? null, ...(extra.referido ? { referidoPorId: extra.referido.porId, referidoPorNombre: extra.referido.porNombre.slice(0, 80), relacionReferido: extra.referido.relacion } : {}), ...(extra.cv ?? {}), respuestas: extra.respuestas ?? undefined, ...resultado, consentimientoEn: extra.consentimiento ? new Date() : null } });
  return "creada";
}

// Las búsquedas que un empleado puede ver en el portal: internas, abiertas,
// de su empresa.
export function busquedasInternas(empresaId: string) {
  return prisma.busqueda.findMany({ where: { empresaId, estado: "abierta", interna: true }, orderBy: { abiertaEn: "desc" } });
}

// Las búsquedas abiertas para las que un empleado puede recomendar gente.
export function busquedasConReferidos(empresaId: string) {
  return prisma.busqueda.findMany({ where: { empresaId, estado: "abierta", referidos: true }, orderBy: { abiertaEn: "desc" } });
}
