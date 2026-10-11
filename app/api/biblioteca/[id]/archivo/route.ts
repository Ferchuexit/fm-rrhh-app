// El archivo de un artículo, para RR.HH. (en cualquier estado).
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { respuestaArchivo } from "@/lib/biblioteca";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return new Response("Sin empresa", { status: 400 });
    return respuestaArchivo(await prisma.articuloBiblioteca.findFirst({ where: { id: params.id, empresaId: empresa.id }, select: { archivoNombre: true, archivoKey: true, archivoBase64: true, archivoMime: true } }));
  } catch (e) {
    console.error("Error en GET /api/biblioteca/[id]/archivo:", e);
    return new Response("No se pudo abrir el archivo", { status: 500 });
  }
}
