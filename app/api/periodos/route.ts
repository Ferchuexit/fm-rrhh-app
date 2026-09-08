// FM RRHH — app/api/periodos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json([]);
  const periodos = await prisma.periodo.findMany({ where: { empresaId: empresa.id }, orderBy: { fechaDesde: "desc" }, include: { convenio: true } });
  return NextResponse.json(periodos);
}

export async function POST(req: Request) {
  const { nombre, fechaDesde, fechaHasta, convenioId } = await req.json();

  if (!nombre?.trim() || !fechaDesde || !fechaHasta) {
    return NextResponse.json({ error: "Faltan nombre, fechaDesde o fechaHasta." }, { status: 400 });
  }
  if (new Date(fechaHasta) < new Date(fechaDesde)) {
    return NextResponse.json({ error: "La fecha hasta no puede ser anterior a la fecha desde." }, { status: 400 });
  }

  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada todavía." }, { status: 400 });

  try {
    const periodo = await prisma.periodo.create({
      data: { empresaId: empresa.id, nombre: nombre.trim(), fechaDesde: new Date(fechaDesde), fechaHasta: new Date(fechaHasta), convenioId: convenioId || null },
    });
    return NextResponse.json(periodo);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: `Ya existe un período con el nombre "${nombre}" para esta empresa.` }, { status: 409 });
    }
    throw e;
  }
}
