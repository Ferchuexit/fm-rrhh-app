// El adjunto de una noticia, para RR.HH.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresasAutorizadas } from "@/lib/empresa-actual";
import { leerArchivo } from "@/lib/almacen-documentos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const n = await prisma.noticia.findUnique({ where: { id: params.id } });
  const autorizadas = await obtenerEmpresasAutorizadas();
  const cuerpo = n && autorizadas.some((e) => e.id === n.empresaId) ? await leerArchivo({ storageKey: n.adjuntoStorageKey, contenidoBase64: n.adjuntoBase64 }) : null;
  if (!n || !cuerpo) return NextResponse.json({ error: "No se encontró el adjunto." }, { status: 404 });
  return new NextResponse(cuerpo, { headers: { "Content-Type": n.adjuntoMime ?? "application/octet-stream", "Content-Disposition": `inline; filename="${(n.adjuntoNombre ?? "adjunto").replace(/[^\w.\-]+/g, "_")}"` } });
}
