import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { get, del } from "@vercel/blob";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresasAutorizadas } from "@/lib/empresa-actual";

// Auditoría de seguridad (08/10/2026) — cabeceras de respuesta de un
// documento privado:
//  - "no-store": ni el navegador ni ningún proxy guardan copia del DNI o
//    del certificado médico después de cerrarlo.
//  - nombre de archivo saneado: un nombre con comillas o saltos de línea
//    rompía la cabecera, y uno con tildes o eñes ("Certificado médico.pdf")
//    directamente hacía fallar la descarga. Va una versión ASCII y, en
//    filename*, el nombre real completo.
//  - sigue siendo "inline" a propósito: se abre en pestaña nueva.
function cabecerasDocumento(tipoMime: string, nombreOriginal: string) {
  const ascii = nombreOriginal.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return {
    "Content-Type": tipoMime,
    "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombreOriginal)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

// GET: devuelve el archivo real (para verlo en una pestaña nueva o descargarlo).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const doc = await prisma.documentoLegajo.findUnique({
    where: { id: params.id },
    include: { legajo: { select: { empresaId: true } } },
  });
  if (!doc) return NextResponse.json({ error: "No se encontró ese documento." }, { status: 404 });

  // Permisos de acceso (documento de mejora, "Documentos y almacenamiento")
  // — hueco real que encontramos: antes CUALQUIER usuario logueado podía
  // pedir CUALQUIER documento por id, sin que se verificara si tenía
  // acceso a la empresa de ese legajo. Mismo mecanismo que ya protege el
  // selector de empresa.
  const empresasAutorizadas = await obtenerEmpresasAutorizadas();
  if (!empresasAutorizadas.some((e) => e.id === doc.legajo.empresaId)) {
    return NextResponse.json({ error: "No tenés acceso a este documento." }, { status: 403 });
  }

  // Auditoría de descargas — un registro por cada vez que alguien
  // efectivamente abre el archivo, no solo que lo vea listado.
  const sesion = await obtenerSesionActual();
  await prisma.descargaDocumento.create({ data: { documentoId: doc.id, usuario: sesion?.email ?? null } });

  // Documentos nuevos: viven en Vercel Blob (privado). Documentos viejos,
  // todavía no migrados: siguen en contenidoBase64 hasta que se corra el
  // script de migración — ver prisma/migrar-documentos-a-blob.ts.
  if (doc.storageKey) {
    const resultado = await get(doc.storageKey, { access: "private" });
    return new NextResponse(resultado.stream as any, { headers: cabecerasDocumento(doc.tipoMime, doc.nombreArchivoOriginal) });
  }

  if (!doc.contenidoBase64) {
    return NextResponse.json({ error: "Este documento no tiene ni storageKey ni contenido — algo salió mal en algún momento." }, { status: 500 });
  }
  const base64Limpio = doc.contenidoBase64.includes(",") ? doc.contenidoBase64.split(",")[1] : doc.contenidoBase64;
  const buffer = Buffer.from(base64Limpio, "base64");

  return new NextResponse(buffer, { headers: cabecerasDocumento(doc.tipoMime, doc.nombreArchivoOriginal) });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const doc = await prisma.documentoLegajo.findUnique({
      where: { id: params.id },
      include: { legajo: { select: { empresaId: true } } },
    });
    if (!doc) return NextResponse.json({ error: "No se encontró ese documento." }, { status: 404 });

    // Mismo control que el GET — antes el borrado no verificaba nada:
    // cualquier usuario logueado podía borrar un documento de otra empresa.
    const empresasAutorizadas = await obtenerEmpresasAutorizadas();
    if (!empresasAutorizadas.some((e) => e.id === doc.legajo.empresaId)) {
      return NextResponse.json({ error: "No tenés acceso a este documento." }, { status: 403 });
    }

    if (doc.storageKey) {
      await del(doc.storageKey).catch((e) => console.error("No se pudo borrar el blob (se borra igual el registro):", e));
    }
    await prisma.documentoLegajo.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/documentos/[id]:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
