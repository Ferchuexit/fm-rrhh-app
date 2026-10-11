// La foto de una publicación, para quien la puede ver en el muro.
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { respuestaFoto, visibleEnMuro } from "@/lib/muro";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return new Response("Sesión vencida", { status: 401 });
    const p = await prisma.publicacion.findFirst({ where: { id: params.id, empresaId: sesion.empresaId }, select: { autorId: true, oculto: true, pendiente: true, fotoKey: true, fotoBase64: true, fotoMime: true } });
    return respuestaFoto(p && visibleEnMuro(p, sesion.legajoId) ? p : null);
  } catch (e) {
    console.error("Error en GET /api/portal/publicaciones/[id]/foto:", e);
    return new Response("No se pudo abrir la foto", { status: 500 });
  }
}
