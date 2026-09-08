// FM RRHH — app/api/conceptos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarNumeroConcepto, sugerirProximoNumero } from "@/lib/motor/catalogo-conceptos.mjs";

export async function GET() {
  const conceptos = await prisma.concepto.findMany({
    orderBy: { numero: "asc" },
    include: { reglas: { where: { vigenciaHasta: null }, include: { convenio: true } } },
  });
  const rangos = await prisma.rangoNumeracion.findMany();
  return NextResponse.json({ conceptos, rangos });
}

export async function POST(req: Request) {
  const { codigo, nombre, tipo, unidad, numero, categoriaNovedad } = await req.json();

  const rangos = await prisma.rangoNumeracion.findMany();
  const conceptosExistentes = await prisma.concepto.findMany();

  const numeroFinal = numero ?? sugerirProximoNumero(tipo, rangos, conceptosExistentes);
  if (numeroFinal == null) {
    return NextResponse.json({ error: `No hay rango configurado para "${tipo}", o está agotado.` }, { status: 400 });
  }

  const validacion = validarNumeroConcepto(numeroFinal, tipo, rangos, conceptosExistentes);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.errores.join(" ") }, { status: 400 });
  }

  const concepto = await prisma.concepto.create({
    data: { codigo: codigo.toUpperCase(), nombre, tipo, unidad, numero: numeroFinal, categoriaNovedad: categoriaNovedad || null },
  });
  return NextResponse.json(concepto);
}
