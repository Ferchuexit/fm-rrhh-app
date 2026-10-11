// El archivo de un artículo, para el empleado que lo puede consultar.
import { obtenerSesionPortal } from "@/lib/portal";
import { articuloPara, respuestaArchivo } from "@/lib/biblioteca";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return new Response("Sesión vencida", { status: 401 });
    return respuestaArchivo(await articuloPara(params.id, sesion.legajoId, false));
  } catch (e) {
    console.error("Error en GET /api/portal/biblioteca/[id]/archivo:", e);
    return new Response("No se pudo abrir el archivo", { status: 500 });
  }
}
