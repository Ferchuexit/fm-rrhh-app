// El empleado abre un documento de SU legajo. Nunca los de la carpeta
// disciplinario/legal, aunque sean suyos — esos son solo de RR.HH.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { CATEGORIA_RESERVADA } from "@/lib/legajo-digital";
import { leerArchivo } from "@/lib/almacen-documentos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

  const doc = await prisma.documentoLegajo.findFirst({ where: { id: params.id, legajoId: sesion.legajoId, categoria: { not: CATEGORIA_RESERVADA } } });
  const cuerpo = doc ? await leerArchivo(doc) : null;
  if (!doc || !cuerpo) return NextResponse.json({ error: "No se encontró ese documento." }, { status: 404 });

  await prisma.descargaDocumento.create({ data: { documentoId: doc.id, usuario: `portal:${sesion.legajoId}` } });
  return new NextResponse(cuerpo, {
    headers: { "Content-Type": doc.tipoMime, "Content-Disposition": `inline; filename="${doc.nombreArchivoOriginal.replace(/[^\w.\-]+/g, "_")}"`, "Cache-Control": "private, no-store" },
  });
}
