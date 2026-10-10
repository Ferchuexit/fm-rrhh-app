// FM RRHH — lib/almacen-documentos.ts
// Guardar y leer el archivo de un DocumentoLegajo. Mismo destino que ya
// usaba la subida de RR.HH.: Vercel Blob PRIVADO (son DNI, certificados
// médicos) — Postgres guarda solo la referencia y el hash.
import { put, get } from "@vercel/blob";
import { createHash } from "crypto";

export async function guardarArchivo(legajoId: string, nombreArchivo: string, buffer: Buffer, tipoMime: string) {
  const hash = createHash("sha256").update(buffer).digest("hex");
  const limpio = nombreArchivo.replace(/[^\w.\-]+/g, "_").slice(-80) || "archivo";
  try {
    const blob = await put(`legajos/${legajoId}/${Date.now()}-${limpio}`, buffer, { access: "private", addRandomSuffix: true, contentType: tipoMime });
    return { storageKey: blob.url, contenidoBase64: null as string | null, hash };
  } catch (e) {
    // En PRODUCCIÓN, si Blob falla, la subida falla — nunca se guarda un
    // archivo real en Postgres. El plan B es solo para probar en una
    // máquina sin credenciales de Blob (npm run dev).
    if (process.env.NODE_ENV === "production") throw e;
    console.warn("[almacen-documentos] Vercel Blob no disponible en desarrollo — el archivo se guarda en la base (solo dev).");
    return { storageKey: null as string | null, contenidoBase64: buffer.toString("base64"), hash };
  }
}

export async function leerArchivo(doc: { storageKey: string | null; contenidoBase64: string | null }): Promise<BodyInit | null> {
  if (doc.storageKey) {
    const resultado = await get(doc.storageKey, { access: "private" });
    return (resultado?.stream as any) ?? null;
  }
  if (!doc.contenidoBase64) return null;
  const base64 = doc.contenidoBase64.includes(",") ? doc.contenidoBase64.split(",")[1] : doc.contenidoBase64;
  return Buffer.from(base64, "base64");
}

// Lo que llega del navegador: un data URL o base64 pelado.
export function bufferDesdeBase64(contenido: unknown): Buffer | null {
  if (typeof contenido !== "string" || !contenido) return null;
  const base64 = contenido.includes(",") ? contenido.split(",")[1] : contenido;
  const buffer = Buffer.from(base64, "base64");
  return buffer.length > 0 ? buffer : null;
}

// No alcanza con creerle al navegador el tipo de archivo: se miran los
// primeros bytes. Devuelve el mime REAL, o null si no es foto ni PDF.
export function mimeReal(buffer: Buffer): string | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
