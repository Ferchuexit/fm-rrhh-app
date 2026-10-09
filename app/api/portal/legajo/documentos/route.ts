// FM RRHH — app/api/portal/legajo/documentos/route.ts
// El empleado sube un documento a su legajo (foto del DNI, constancia de
// CUIL, un certificado). Entra como PENDIENTE: no tilda nada en el
// checklist hasta que RR.HH. lo acepta.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { TIPOS_DOCUMENTO, esTipoDocumento, TAMANIO_MAXIMO_BYTES } from "@/lib/legajo-digital";
import { guardarArchivo, bufferDesdeBase64, mimeReal } from "@/lib/almacen-documentos";

export const dynamic = "force-dynamic";
const MAX_EN_REVISION = 8; // por legajo — para que nadie llene la bandeja de RR.HH. por error

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!esTipoDocumento(body.tipo) || TIPOS_DOCUMENTO[body.tipo].quien !== "empleado") {
      return NextResponse.json({ error: "Ese tipo de documento lo carga RR.HH." }, { status: 400 });
    }
    const tipo = body.tipo;
    const buffer = bufferDesdeBase64(body.contenidoBase64);
    if (!buffer) return NextResponse.json({ error: "Elegí una foto o un PDF." }, { status: 400 });
    if (buffer.length > TAMANIO_MAXIMO_BYTES) return NextResponse.json({ error: "El archivo pesa más de 3 MB. Sacá la foto con menos calidad o subí un PDF más liviano." }, { status: 413 });
    const mime = mimeReal(buffer);
    if (!mime) return NextResponse.json({ error: "Solo se aceptan fotos (JPG, PNG) o PDF." }, { status: 400 });

    const enRevision = await prisma.documentoLegajo.count({ where: { legajoId: sesion.legajoId, estado: "pendiente" } });
    if (enRevision >= MAX_EN_REVISION) return NextResponse.json({ error: "Ya tenés varios documentos esperando revisión. Esperá a que RR.HH. los mire antes de subir más." }, { status: 429 });

    const detalle = String(body.detalle ?? "").trim().slice(0, 80);
    const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
    const archivo = await guardarArchivo(sesion.legajoId, `${tipo}.${ext}`, buffer, mime);

    const doc = await prisma.documentoLegajo.create({
      data: {
        legajoId: sesion.legajoId, tipo, categoria: TIPOS_DOCUMENTO[tipo].categoria,
        nombre: detalle ? `${TIPOS_DOCUMENTO[tipo].nombre} — ${detalle}` : TIPOS_DOCUMENTO[tipo].nombre,
        nombreArchivoOriginal: `${tipo}.${ext}`, tipoMime: mime, ...archivo,
        estado: "pendiente", origen: "empleado", subidoPor: `${sesion.nombre} (portal)`,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e: any) {
    console.error("Error en POST /api/portal/legajo/documentos:", e);
    return NextResponse.json({ error: "No se pudo subir el documento. Probá de nuevo en un momento." }, { status: 500 });
  }
}
