import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { put } from "@vercel/blob";
import { createHash } from "crypto";
import { obtenerEmpresasAutorizadas } from "@/lib/empresa-actual";

const CATEGORIAS_VALIDAS = ["personal", "laboral", "novedades", "disciplinario_legal"];

// Vercel corta cualquier request de más de 4,5 MB, y el archivo viaja en
// base64 (ocupa un tercio más que el original). Por eso el tope real es
// ~3 MB: se valida acá para devolver un mensaje claro en vez de un error
// genérico de la plataforma.
const TAMANIO_MAXIMO_BYTES = 3 * 1024 * 1024;

// Auditoría de seguridad (08/10/2026) — ni el listado ni la subida
// verificaban que el legajo fuera de una empresa a la que el usuario tiene
// acceso. Mismo criterio que /api/documentos/[id].
async function tieneAccesoAlLegajo(legajoId: string) {
  const legajo = await prisma.legajo.findUnique({ where: { id: legajoId }, select: { empresaId: true } });
  if (!legajo) return false;
  const empresasAutorizadas = await obtenerEmpresasAutorizadas();
  return empresasAutorizadas.some((e) => e.id === legajo.empresaId);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await tieneAccesoAlLegajo(params.id))) {
    return NextResponse.json({ error: "No se encontró ese legajo, o no tenés acceso a él." }, { status: 404 });
  }

  // select explícito, SIN contenidoBase64 — la lista tiene que ser liviana,
  // el contenido pesado se pide aparte solo cuando alguien abre el documento.
  const documentos = await prisma.documentoLegajo.findMany({
    where: { legajoId: params.id },
    orderBy: { fechaSubida: "desc" },
    select: {
      id: true, categoria: true, nombre: true, nombreArchivoOriginal: true,
      tipoMime: true, fechaSubida: true, subidoPor: true,
    },
  });
  return NextResponse.json(documentos);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await tieneAccesoAlLegajo(params.id))) {
      return NextResponse.json({ error: "No se encontró ese legajo, o no tenés acceso a él." }, { status: 404 });
    }

    const { categoria, nombre, nombreArchivoOriginal, tipoMime, contenidoBase64 } = await req.json();

    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
      return NextResponse.json({ error: `Categoría inválida. Tiene que ser una de: ${CATEGORIAS_VALIDAS.join(", ")}.` }, { status: 400 });
    }
    if (!nombre?.trim() || !contenidoBase64) {
      return NextResponse.json({ error: "Faltan nombre o el archivo en sí." }, { status: 400 });
    }

    const sesion = await obtenerSesionActual();

    // Documento de mejora, "Documentos y almacenamiento" — el archivo va
    // directo a Vercel Blob (privado, nunca público — son DNI, certificados
    // médicos, notificaciones legales), Postgres solo guarda la referencia
    // (storageKey) y un hash para poder verificar integridad después.
    // Server upload vía put(): límite de 4.5MB por archivo (límite de
    // Vercel Functions) — más que suficiente para lo que se sube acá
    // (PDFs/fotos de documentos, no videos).
    const base64Limpio = contenidoBase64.includes(",") ? contenidoBase64.split(",")[1] : contenidoBase64;
    const buffer = Buffer.from(base64Limpio, "base64");
    if (buffer.length > TAMANIO_MAXIMO_BYTES) {
      return NextResponse.json({ error: "El archivo pesa más de 3 MB — comprimilo o escanealo en menor resolución y volvé a subirlo." }, { status: 413 });
    }
    const hash = createHash("sha256").update(buffer).digest("hex");

    const blob = await put(`legajos/${params.id}/${Date.now()}-${nombreArchivoOriginal ?? nombre.trim()}`, buffer, {
      access: "private",
      addRandomSuffix: true,
      contentType: tipoMime ?? "application/octet-stream",
    });

    const documento = await prisma.documentoLegajo.create({
      data: {
        legajoId: params.id,
        categoria,
        nombre: nombre.trim(),
        nombreArchivoOriginal: nombreArchivoOriginal ?? nombre.trim(),
        tipoMime: tipoMime ?? "application/octet-stream",
        storageKey: blob.url,
        hash,
        subidoPor: sesion?.nombre ?? null,
      },
      select: {
        id: true, categoria: true, nombre: true, nombreArchivoOriginal: true,
        tipoMime: true, fechaSubida: true, subidoPor: true,
      },
    });
    return NextResponse.json(documento);
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/documentos:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo subir el documento." }, { status: 500 });
  }
}
