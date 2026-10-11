// FM RRHH — lib/reclutamiento.ts
// Lado base de datos de las búsquedas y los candidatos.
import { prisma, prismaSistema } from "./prisma";
import { guardarEnCarpeta, mimeReal } from "./almacen-documentos";
import { MAX_CV_BYTES, type DatosPostulacion } from "./reclutamiento-reglas";
export * from "./reclutamiento-reglas";

export const MAX_CANDIDATOS_POR_BUSQUEDA = 1000;

// Lo que se puede mostrar de un candidato en el panel: todo menos el
// archivo del CV (que se baja aparte).
export const CAMPOS_CANDIDATO = { id: true, busquedaId: true, apellido: true, nombre: true, email: true, telefono: true, localidad: true, mensaje: true, fuente: true, empleadoId: true, cvNombre: true, etapa: true, etapaDesde: true, motivoDescarte: true, puntaje: true, notas: true, createdAt: true } as const;

// El CV: solo PDF de verdad (se miran los primeros bytes, no la extensión)
// y hasta 4 MB. Devuelve los campos a guardar, o el motivo del rechazo.
export async function prepararCV(archivo: File | null, busquedaId: string): Promise<{ error: string } | { cvNombre: string | null; cvKey: string | null; cvBase64: string | null }> {
  if (!archivo || archivo.size === 0) return { cvNombre: null, cvKey: null, cvBase64: null };
  if (archivo.size > MAX_CV_BYTES) return { error: "El CV pesa más de 4 MB. Probá con un PDF más liviano." };
  const buffer = Buffer.from(await archivo.arrayBuffer());
  if (mimeReal(buffer) !== "application/pdf") return { error: "El CV tiene que ser un archivo PDF." };
  const g = await guardarEnCarpeta(`candidatos/${busquedaId}`, archivo.name || "cv.pdf", buffer, "application/pdf");
  return { cvNombre: (archivo.name || "cv.pdf").replace(/[^\w.\- ]+/g, "_").slice(-80), cvKey: g.storageKey, cvBase64: g.contenidoBase64 };
}

// Guarda una postulación. `db`: el cliente a usar — la página pública no
// tiene sesión y usa el del sistema; el panel, el suyo.
// Si la misma persona (mismo mail o teléfono) ya se postuló a ESA
// búsqueda, no se duplica.
export async function registrarPostulacion(db: typeof prisma | typeof prismaSistema, busquedaId: string, datos: DatosPostulacion, extra: { fuente: string; empleadoId?: string | null; cv?: { cvNombre: string | null; cvKey: string | null; cvBase64: string | null }; consentimiento?: boolean }): Promise<"creada" | "repetida" | "llena"> {
  const mismos = [...(datos.email ? [{ email: datos.email }] : []), ...(datos.telefono ? [{ telefono: datos.telefono }] : []), ...(extra.empleadoId ? [{ empleadoId: extra.empleadoId }] : [])];
  if (mismos.length > 0 && (await (db as typeof prisma).candidato.count({ where: { busquedaId, OR: mismos } })) > 0) return "repetida";
  if ((await (db as typeof prisma).candidato.count({ where: { busquedaId } })) >= MAX_CANDIDATOS_POR_BUSQUEDA) return "llena";
  await (db as typeof prisma).candidato.create({ data: { busquedaId, ...datos, fuente: extra.fuente, empleadoId: extra.empleadoId ?? null, ...(extra.cv ?? {}), consentimientoEn: extra.consentimiento ? new Date() : null } });
  return "creada";
}

// Las búsquedas que un empleado puede ver en el portal: internas, abiertas,
// de su empresa.
export function busquedasInternas(empresaId: string) {
  return prisma.busqueda.findMany({ where: { empresaId, estado: "abierta", interna: true }, orderBy: { abiertaEn: "desc" } });
}
