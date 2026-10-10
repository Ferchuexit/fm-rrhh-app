// El adjunto de una noticia, para el empleado — solo si la noticia es para él.
import { NextResponse } from "next/server";
import { obtenerSesionPortal } from "@/lib/portal";
import { noticiaDelEmpleado } from "@/lib/noticias";
import { leerArchivo } from "@/lib/almacen-documentos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
  const n = await noticiaDelEmpleado(params.id, sesion.legajoId);
  const cuerpo = n ? await leerArchivo({ storageKey: n.adjuntoStorageKey, contenidoBase64: n.adjuntoBase64 }) : null;
  if (!n || !cuerpo) return NextResponse.json({ error: "No se encontró el adjunto." }, { status: 404 });
  return new NextResponse(cuerpo, {
    headers: { "Content-Type": n.adjuntoMime ?? "application/octet-stream", "Content-Disposition": `inline; filename="${(n.adjuntoNombre ?? "adjunto").replace(/[^\w.\-]+/g, "_")}"`, "Cache-Control": "private, max-age=300" },
  });
}
