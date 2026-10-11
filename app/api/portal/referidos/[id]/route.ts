// FM RRHH — app/api/portal/referidos/[id]/route.ts
// Un empleado recomienda a alguien para una búsqueda que acepta referidos.
// El recomendado entra como un candidato más (fuente "referido"), con el
// nombre de quien lo recomendó: pasa por el mismo proceso que el resto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { validarReferido, prepararCV, registrarPostulacion, filtrosDe } from "@/lib/reclutamiento";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "No llegó el formulario. Probá de nuevo." }, { status: 400 });
    const [busqueda, yo, yaReferidos] = await Promise.all([
      prisma.busqueda.findFirst({ where: { id: params.id, empresaId: sesion.empresaId, estado: "abierta", referidos: true }, select: { id: true, preguntas: true, palabrasClave: true } }),
      prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { nombre: true, apellido: true, condicion: true } }),
      prisma.candidato.count({ where: { busquedaId: params.id, referidoPorId: sesion.legajoId } }),
    ]);
    if (!busqueda || !yo || yo.condicion !== "activo") return NextResponse.json({ error: "Esa búsqueda ya no recibe recomendaciones." }, { status: 409 });
    const { referido, error } = validarReferido(Object.fromEntries(form), yaReferidos);
    if (!referido) return NextResponse.json({ error }, { status: 400 });
    const cv = await prepararCV(form.get("cv") instanceof File ? (form.get("cv") as File) : null, busqueda.id);
    if ("error" in cv) return NextResponse.json({ error: cv.error }, { status: 400 });
    // Las preguntas de filtro no se le hacen a quien recomienda (no las
    // puede contestar por otro): queda sin puntaje de preguntas y RR.HH. lo
    // evalúa a mano. Las palabras clave sí se buscan en el CV.
    const r = await registrarPostulacion(prisma, busqueda.id, referido.datos, { fuente: "referido", referido: { porId: sesion.legajoId, porNombre: `${yo.nombre} ${yo.apellido}`, relacion: referido.relacion }, cv, consentimiento: true, filtros: { preguntas: [], palabras: filtrosDe(busqueda).palabras } });
    if (r === "repetida") return NextResponse.json({ error: "Esa persona ya está anotada en esta búsqueda (por su cuenta o porque alguien más la recomendó)." }, { status: 409 });
    if (r === "llena") return NextResponse.json({ error: "Esa búsqueda ya no recibe recomendaciones." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/referidos/[id]:", e);
    return NextResponse.json({ error: "No se pudo enviar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
