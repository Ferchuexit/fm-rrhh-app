// FM RRHH — app/api/novedades/confirmar/route.ts
// Recibe SOLO las filas que ya pasaron por /api/novedades/validar con
// estado "valida" y las inserta. No vuelve a validar acá — si el cliente
// manda una fila con error, es un bug del cliente, no algo que este endpoint
// deba adivinar; la responsabilidad de filtrar ya se cumplió en la pantalla.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { periodoId, filasValidas } = await req.json();

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  const legajos = await prisma.legajo.findMany({ where: { empresaId: periodo.empresaId } });
  const conceptos = await prisma.concepto.findMany();

  let insertadas = 0;
  for (const fila of filasValidas) {
    const legajo = legajos.find((l) => l.numeroLegajo === Number(fila.legajoNumero));
    const concepto = conceptos.find((c) => c.codigo === fila.conceptoCodigo);
    if (!legajo || !concepto) continue; // no debería pasar si ya validó, pero no reventamos el resto del lote por una fila rara

    await prisma.novedad.create({
      data: {
        empresaId: periodo.empresaId,
        legajoId: legajo.id,
        periodo: new Date(fila.fecha),
        conceptoId: concepto.id,
        cantidad: fila.cantidad != null ? Number(fila.cantidad) : null,
        valor: fila.valor != null ? Number(fila.valor) : null,
        estado: "valida",
      },
    });
    insertadas++;
  }

  return NextResponse.json({ insertadas });
}
