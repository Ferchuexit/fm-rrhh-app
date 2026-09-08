// FM RRHH — app/api/cerrar/route.ts
// Recibe periodoId + justificaciones (puede venir vacío, si no hay alertas
// rojas no hace falta ninguna). Vuelve a auditar en el momento (no confía en
// un resultado que la pantalla pudo haber guardado hace un rato — el período
// pudo haber cambiado mientras tanto) y aplica evaluarCierreConSalvedad().
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerResultadoAuditoria } from "@/lib/auditoria-context";
import { evaluarCierreConSalvedad } from "@/lib/motor/aprobacion-salvedad.mjs";

export async function POST(req: Request) {
  const { periodoId, justificaciones = [] } = await req.json();

  // Flujo de aprobación: si la ÚLTIMA aprobación registrada para este
  // período fue un rechazo explícito, no se puede cerrar hasta volver a
  // aprobarlo — a diferencia de las alertas rojas (que se pueden saltear
  // con una salvedad justificada), un rechazo es una decisión humana
  // explícita, no algo que el sistema deba dejar pasar con una excusa.
  // Si nunca se usó esta pantalla, no bloquea nada (períodos viejos, o
  // quien no necesita el paso formal, siguen funcionando igual que antes).
  const ultimaAprobacion = await prisma.aprobacionPeriodo.findFirst({ where: { periodoId }, orderBy: { fecha: "desc" } });
  if (ultimaAprobacion?.estado === "rechazado") {
    return NextResponse.json(
      {
        cerrado: false,
        error: `Este período fue RECHAZADO en la aprobación (${ultimaAprobacion.observaciones ?? "sin motivo detallado"}) — hay que volver a aprobarlo en /auditoria antes de poder cerrarlo.`,
      },
      { status: 409 }
    );
  }

  const resultadoAuditoria = await obtenerResultadoAuditoria(periodoId);
  const evaluacion = evaluarCierreConSalvedad(resultadoAuditoria, justificaciones);

  if (!evaluacion.puedeCerrar) {
    return NextResponse.json({ cerrado: false, ...evaluacion }, { status: 409 });
  }

  await prisma.periodo.update({ where: { id: periodoId }, data: { estado: "cerrada", fechaCierre: new Date(), fueCerradaAlgunaVez: true } });

  if (evaluacion.salvedadesAplicadas?.length) {
    await prisma.salvedad.createMany({
      data: evaluacion.salvedadesAplicadas.map((s: any) => ({
        periodoId,
        tipo: s.tipo,
        mensaje: s.mensaje,
        motivo: s.motivo,
      })),
    });
  }

  return NextResponse.json({ cerrado: true, ...evaluacion });
}

// Reabre un período cerrado — paso obligatorio antes de poder tocar una
// liquidación ya cerrada (liquidar, borrar liquidaciones, etc. la rechazan
// mientras el período siga cerrado). Deliberadamente sin condiciones para
// reabrir — cerrar SÍ tiene requisitos (sin alertas rojas), reabrir no,
// porque es un paso hacia atrás, no hacia adelante.
export async function DELETE(req: Request) {
  const { periodoId } = await req.json();
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  if (periodo.estado !== "cerrada") {
    return NextResponse.json({ error: `El período "${periodo.nombre}" no está cerrado — no hay nada que reabrir.` }, { status: 400 });
  }

  await prisma.periodo.update({ where: { id: periodoId }, data: { estado: "validada", fechaCierre: null } });
  return NextResponse.json({ reabierto: true });
}
