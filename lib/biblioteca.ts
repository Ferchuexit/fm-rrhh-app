// FM RRHH — lib/biblioteca.ts
// Lado base de datos de la Librería de conocimiento.
import { prisma } from "./prisma";
import { guardarEnCarpeta, leerArchivo, mimeReal } from "./almacen-documentos";
import { textoDelPDF } from "./reclutamiento";
import { loVe, motivoArchivoInvalido } from "./biblioteca-reglas";
export * from "./biblioteca-reglas";

// Para listar: todo menos el archivo y su texto (que puede ser largo).
export const CAMPOS_LISTA = { id: true, titulo: true, categoria: true, contenido: true, enlace: true, archivoNombre: true, archivoMime: true, centroCostoIds: true, destacado: true, estado: true, actualizadoEn: true, publicadoEn: true } as const;

// Guarda el archivo de un artículo. Si es un PDF con texto, se lo extrae
// para que el buscador encuentre lo que dice adentro.
export async function prepararArchivo(archivo: File | null, empresaId: string): Promise<{ error: string } | { archivoNombre: string; archivoKey: string | null; archivoBase64: string | null; archivoMime: string; archivoTexto: string | null } | null> {
  if (!archivo || archivo.size === 0) return null;
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const mime = mimeReal(buffer);
  const mal = motivoArchivoInvalido(buffer.length, mime);
  if (mal) return { error: mal };
  const g = await guardarEnCarpeta(`biblioteca/${empresaId}`, archivo.name || "archivo", buffer, mime!);
  return { archivoNombre: (archivo.name || "archivo").replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]+/g, "_").slice(-100), archivoKey: g.storageKey, archivoBase64: g.contenidoBase64, archivoMime: mime!, archivoTexto: mime === "application/pdf" ? await textoDelPDF(buffer) : null };
}

export async function respuestaArchivo(a: { archivoNombre: string | null; archivoKey: string | null; archivoBase64: string | null; archivoMime: string | null } | null): Promise<Response> {
  const archivo = a && (a.archivoKey || a.archivoBase64) ? await leerArchivo({ storageKey: a.archivoKey, contenidoBase64: a.archivoBase64 }) : null;
  if (!a || !archivo) return new Response("No encontrado", { status: 404 });
  const nombre = (a.archivoNombre ?? "archivo").replace(/[^\w.\- ]+/g, "_");
  return new Response(archivo, { headers: { "Content-Type": a.archivoMime ?? "application/octet-stream", "Content-Disposition": `inline; filename="${nombre}"`, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}

// Lo que un empleado puede consultar: lo publicado para toda la empresa o
// para su sector. Trae también el texto del PDF, para el buscador (no sale
// del servidor).
export async function articulosPara(legajoId: string) {
  const yo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true, condicion: true } });
  if (!yo || yo.condicion !== "activo") return [];
  const lista = await prisma.articuloBiblioteca.findMany({ where: { empresaId: yo.empresaId, estado: "publicado" }, select: { ...CAMPOS_LISTA, archivoTexto: true }, orderBy: { titulo: "asc" } });
  return lista.filter((a) => loVe(a, yo.centroCostoId));
}

// Un artículo, si esta persona lo puede ver. Deja anotado que lo abrió.
export async function articuloPara(id: string, legajoId: string, anotar: boolean) {
  const yo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true, condicion: true } });
  const a = yo && yo.condicion === "activo" ? await prisma.articuloBiblioteca.findFirst({ where: { id, empresaId: yo.empresaId } }) : null;
  if (!a || !loVe(a, yo!.centroCostoId)) return null;
  if (anotar) await prisma.lecturaBiblioteca.upsert({ where: { articuloId_legajoId: { articuloId: id, legajoId } }, create: { articuloId: id, legajoId }, update: { leidoEn: new Date() } }).catch(() => null);
  return a;
}
