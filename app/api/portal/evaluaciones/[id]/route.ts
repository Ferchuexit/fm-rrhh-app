// FM RRHH — app/api/portal/evaluaciones/[id]/route.ts
// Desde el portal, sobre UNA evaluación:
//   guardar / completar → el JEFE que la tiene asignada, mientras el ciclo
//       esté abierto y RR.HH. no la haya entregado.
//   firmar → el EMPLEADO evaluado, una vez entregada: conforme o en
//       disconformidad (con comentario). Queda fecha, hora y desde dónde.
// Quién puede qué sale de la sesión, nunca de lo que manda el formulario.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, ipDelPedido } from "@/lib/portal";
import { datosDeEvaluacion, type Competencia } from "@/lib/evaluaciones";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    if (body.accion === "firmar") {
      const firma = body.firma === "conforme" || body.firma === "disconforme" ? body.firma : null;
      if (!firma) return NextResponse.json({ error: "Elegí si firmás conforme o en disconformidad." }, { status: 400 });
      const comentario = String(body.comentario ?? "").trim().slice(0, 1500);
      if (firma === "disconforme" && comentario.length < 10) return NextResponse.json({ error: "Contá con qué no estás de acuerdo, así RR.HH. lo puede revisar." }, { status: 400 });
      const { count } = await prisma.evaluacion.updateMany({
        where: { id: params.id, legajoId: sesion.legajoId, estado: "entregada" },
        data: { estado: "firmada", firma, comentarioEmpleado: comentario || null, firmadoEn: new Date(), firmaIp: ipDelPedido() },
      });
      if (count === 0) return NextResponse.json({ error: "Esa evaluación ya la firmaste, o todavía no te la entregaron." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    if (body.accion !== "guardar" && body.accion !== "completar") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    const ev = await prisma.evaluacion.findFirst({ where: { id: params.id, evaluadorId: sesion.legajoId }, include: { ciclo: { select: { competencias: true, estado: true } } } });
    if (!ev) return NextResponse.json({ error: "Esa evaluación no está a tu cargo." }, { status: 404 });
    if (ev.ciclo.estado !== "abierto") return NextResponse.json({ error: "RR.HH. ya cerró este ciclo de evaluación." }, { status: 409 });
    if (ev.estado === "entregada" || ev.estado === "firmada") return NextResponse.json({ error: "Esa evaluación ya se entregó: no se modifica." }, { status: 409 });
    // Una ya completada no vuelve a borrador por tocar "guardar": se
    // corrige completa o no se corrige.
    const completar = body.accion === "completar" || ev.estado === "completada";
    const r = datosDeEvaluacion(ev.ciclo.competencias as unknown as Competencia[], body, completar, `jefe: ${sesion.nombre}`);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const { count } = await prisma.evaluacion.updateMany({ where: { id: ev.id, evaluadorId: sesion.legajoId, estado: { in: ["pendiente", "completada"] } }, data: r.data });
    if (count === 0) return NextResponse.json({ error: "RR.HH. la acaba de entregar: ya no se modifica." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/portal/evaluaciones/[id]:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
