// FM RRHH — app/api/portal/encuestas/[id]/route.ts
// El empleado responde una encuesta. Se guardan DOS cosas separadas, en la
// misma operación:
//   - que esta persona ya respondió (para que no responda dos veces);
//   - las respuestas, SIN la persona y sin fecha ni hora.
// No queda nada que una una fila con la otra.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { limpiarRespuestas, type Pregunta } from "@/lib/encuestas";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    const [encuesta, legajo] = await Promise.all([
      prisma.encuesta.findFirst({ where: { id: params.id, empresaId: sesion.empresaId, estado: "abierta", fechaCierre: { gte: hoyArgentina() } } }),
      prisma.legajo.findUnique({ where: { id: sesion.legajoId }, select: { condicion: true, centroCostoId: true, centroCosto: { select: { nombre: true } } } }),
    ]);
    if (!encuesta || !legajo || legajo.condicion !== "activo") return NextResponse.json({ error: "Esa encuesta ya cerró." }, { status: 409 });
    if (encuesta.centroCostoIds.length > 0 && !(legajo.centroCostoId && encuesta.centroCostoIds.includes(legajo.centroCostoId))) return NextResponse.json({ error: "Esa encuesta no es para tu sector." }, { status: 403 });

    const { respuestas, error } = limpiarRespuestas(encuesta.preguntas as unknown as Pregunta[], body.respuestas);
    if (error) return NextResponse.json({ error }, { status: 400 });

    try {
      await prisma.$transaction([
        prisma.participacionEncuesta.create({ data: { encuestaId: encuesta.id, legajoId: sesion.legajoId } }),
        prisma.respuestaEncuesta.create({ data: { encuestaId: encuesta.id, sector: legajo.centroCosto?.nombre ?? null, respuestas } }),
      ]);
    } catch (e: any) {
      if (e?.code === "P2002") return NextResponse.json({ error: "Ya respondiste esta encuesta." }, { status: 409 });
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/encuestas/[id]:", e);
    return NextResponse.json({ error: "No se pudo enviar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
