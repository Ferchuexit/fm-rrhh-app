// La foto de una publicación, para RR.HH. (también de las ocultas y las
// que esperan aprobación: tiene que poder verlas para decidir).
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { respuestaFoto } from "@/lib/muro";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return new Response("Sin empresa", { status: 400 });
    return respuestaFoto(await prisma.publicacion.findFirst({ where: { id: params.id, empresaId: empresa.id }, select: { fotoKey: true, fotoBase64: true, fotoMime: true } }));
  } catch (e) {
    console.error("Error en GET /api/publicaciones/[id]/foto:", e);
    return new Response("No se pudo abrir la foto", { status: 500 });
  }
}
