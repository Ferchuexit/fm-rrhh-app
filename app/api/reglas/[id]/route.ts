// FM RRHH — app/api/reglas/[id]/route.ts
//
// Antes no existía ninguna forma de eliminar una regla ya guardada — solo
// se podía versionar (crear una nueva que cierra la vigencia de la
// anterior). Hacía falta un DELETE real para poder deshacer una fórmula
// guardada por error (ej. una fórmula para EMBARGO_JUDICIAL, que no puede
// tener una — ver el bloqueo en app/api/reglas/route.ts).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const regla = await prisma.reglaConcepto.findUnique({ where: { id: params.id } });
  if (!regla) return NextResponse.json({ error: "Esa regla no existe (¿ya se borró?)." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.reglaConcepto.delete({ where: { id: params.id } });

    // Si esta regla, al crearse, cerró la vigencia de una versión anterior
    // del mismo concepto+convenio, reabrirla — si no, borrar la última
    // versión dejaría al concepto sin ninguna fórmula vigente por error,
    // en vez de volver a la que estaba antes.
    const cierre = new Date(regla.vigenciaDesde);
    cierre.setDate(cierre.getDate() - 1);
    await tx.reglaConcepto.updateMany({
      where: { conceptoId: regla.conceptoId, convenioId: regla.convenioId, vigenciaHasta: cierre },
      data: { vigenciaHasta: null },
    });
  });

  return NextResponse.json({ ok: true });
}
