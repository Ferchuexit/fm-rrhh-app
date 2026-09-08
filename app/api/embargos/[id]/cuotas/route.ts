import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { anio, mes, importe } = await req.json();
    if (!anio || !mes || importe === undefined || importe === null || importe === "") {
      return NextResponse.json({ error: "Faltan año, mes o importe." }, { status: 400 });
    }

    const embargo = await prisma.embargo.findUnique({ where: { id: params.id }, include: { cuotas: true } });
    if (!embargo) return NextResponse.json({ error: "No se encontró el embargo." }, { status: 404 });
    if (embargo.tipo !== "comercial") {
      return NextResponse.json({ error: "Las cuotas mes a mes son solo para embargos comerciales — el judicial ya se calcula solo, con el %." }, { status: 400 });
    }

    // Aviso, no bloqueo: si la suma de las cuotas ya cargadas más esta
    // supera el monto total de la deuda, se avisa igual que hace
    // liquidar/route.ts al momento de aplicarla — acá es un chequeo
    // temprano, para que Fernando lo vea al cargar, no recién al liquidar.
    const totalCargado = embargo.cuotas.reduce((a, c) => a + c.importe, 0) + Number(importe);
    const advertencia = embargo.montoTotal != null && totalCargado > embargo.montoTotal
      ? `Ojo: con esta cuota, el total cargado ($${totalCargado.toLocaleString("es-AR")}) supera el monto total de la deuda ($${embargo.montoTotal.toLocaleString("es-AR")}).`
      : null;

    const cuota = await prisma.cuotaEmbargo.create({
      data: { embargoId: params.id, anio: Number(anio), mes: Number(mes), importe: Number(importe) },
    });
    return NextResponse.json({ ...cuota, advertencia });
  } catch (e: any) {
    console.error("Error en POST /api/embargos/[id]/cuotas:", e);
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya hay una cuota cargada para ese mes en este embargo — borrala primero si la querés cambiar." }, { status: 400 });
    }
    return NextResponse.json({ error: e.message ?? "No se pudo agregar la cuota." }, { status: 500 });
  }
}
