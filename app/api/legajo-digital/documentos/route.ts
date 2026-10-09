// RR.HH. sube un documento del checklist a un legajo (por ejemplo el alta
// temprana de ARCA, o el DNI de alguien que no usa el portal). Entra ya
// aceptado: quien lo sube es quien lo hubiera revisado.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { TIPOS_DOCUMENTO, esTipoDocumento, TAMANIO_MAXIMO_BYTES } from "@/lib/legajo-digital";
import { guardarArchivo, bufferDesdeBase64, mimeReal } from "@/lib/almacen-documentos";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    if (!esTipoDocumento(body.tipo)) return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
    const tipo = body.tipo;
    const legajo = await prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true } });
    if (!legajo) return NextResponse.json({ error: "No se encontró ese legajo en la empresa actual." }, { status: 404 });

    const buffer = bufferDesdeBase64(body.contenidoBase64);
    if (!buffer) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    if (buffer.length > TAMANIO_MAXIMO_BYTES) return NextResponse.json({ error: "El archivo pesa más de 3 MB — comprimilo o escanealo en menor resolución." }, { status: 413 });
    const mime = mimeReal(buffer);
    if (!mime) return NextResponse.json({ error: "Solo se aceptan fotos (JPG, PNG) o PDF." }, { status: 400 });

    const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
    const archivo = await guardarArchivo(legajo.id, `${tipo}.${ext}`, buffer, mime);
    await prisma.documentoLegajo.create({
      data: {
        legajoId: legajo.id, tipo, categoria: TIPOS_DOCUMENTO[tipo].categoria, nombre: TIPOS_DOCUMENTO[tipo].nombre,
        nombreArchivoOriginal: `${tipo}.${ext}`, tipoMime: mime, ...archivo,
        estado: "aceptado", origen: "rrhh", subidoPor: sesion.nombre, revisadoPor: sesion.email, revisadoEn: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/legajo-digital/documentos:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo subir el documento." }, { status: 500 });
  }
}
