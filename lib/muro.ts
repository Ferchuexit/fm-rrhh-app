// FM RRHH — lib/muro.ts
// Lado base de datos de las publicaciones del muro.
import { prisma } from "./prisma";
import { guardarEnCarpeta, leerArchivo, mimeReal } from "./almacen-documentos";
import { motivoFotoInvalida, validarPublicacion } from "./muro-reglas";
export * from "./muro-reglas";

// Publica. `autor`: el empleado, o null si publica RR.HH. desde el panel
// (`nombre` es entonces el de la empresa). `pendiente`: si queda esperando
// el visto bueno.
export async function publicar(empresaId: string, autor: { id: string } | null, nombre: string, textoCrudo: unknown, archivo: File | null, pendiente: boolean, hoy: Date): Promise<{ error: string; status: number } | { ok: true; id: string; pendiente: boolean }> {
  const conFoto = !!archivo && archivo.size > 0;
  const deHoy = autor ? await prisma.publicacion.count({ where: { autorId: autor.id, createdAt: { gte: hoy } } }) : null;
  const { texto, error } = validarPublicacion(textoCrudo, conFoto, deHoy);
  if (error) return { error, status: 400 };
  let foto: { fotoKey: string | null; fotoBase64: string | null; fotoMime: string | null } = { fotoKey: null, fotoBase64: null, fotoMime: null };
  if (conFoto) {
    const buffer = Buffer.from(await archivo!.arrayBuffer());
    const mime = mimeReal(buffer);
    const mal = motivoFotoInvalida(buffer.length, mime);
    if (mal) return { error: mal, status: 400 };
    const g = await guardarEnCarpeta(`muro/${empresaId}`, `foto.${mime!.split("/")[1]}`, buffer, mime!);
    foto = { fotoKey: g.storageKey, fotoBase64: g.contenidoBase64, fotoMime: mime };
  }
  const p = await prisma.publicacion.create({ data: { empresaId, autorId: autor?.id ?? null, autorNombre: nombre.slice(0, 80), texto, ...foto, pendiente } });
  return { ok: true, id: p.id, pendiente };
}

// La foto de una publicación, lista para devolver. `ver`: si este pedido
// la puede ver (lo decide quien llama: portal o panel).
export async function respuestaFoto(p: { fotoKey: string | null; fotoBase64: string | null; fotoMime: string | null } | null): Promise<Response> {
  const archivo = p && (p.fotoKey || p.fotoBase64) ? await leerArchivo({ storageKey: p.fotoKey, contenidoBase64: p.fotoBase64 }) : null;
  if (!p || !archivo) return new Response("No encontrada", { status: 404 });
  return new Response(archivo, { headers: { "Content-Type": p.fotoMime ?? "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}

export const CAMPOS_PUBLICACION = { id: true, autorId: true, autorNombre: true, texto: true, fotoMime: true, pendiente: true, oculto: true, createdAt: true } as const;
