// FM RRHH — app/api/indicadores/route.ts
// El tablero de indicadores de Gestión Humana (?meses=3|6|12&sector=<id>).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { indicadores } from "@/lib/indicadores";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const q = new URL(req.url).searchParams;
    const meses = [3, 6, 12].includes(Number(q.get("meses"))) ? Number(q.get("meses")) : 12;
    const pedido = q.get("sector");
    const sector = pedido ? await prisma.centroCosto.findFirst({ where: { id: pedido, empresaId: empresa.id }, select: { id: true } }) : null;
    return NextResponse.json({ empresa: empresa.nombreFantasia || empresa.razonSocial, ...(await indicadores(empresa.id, hoyArgentina(), meses, sector?.id ?? null)) });
  } catch (e) {
    console.error("Error en GET /api/indicadores:", e);
    return NextResponse.json({ error: "No se pudieron calcular los indicadores. Probá de nuevo en un momento." }, { status: 500 });
  }
}
