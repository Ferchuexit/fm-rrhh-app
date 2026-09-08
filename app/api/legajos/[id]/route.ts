import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: params.id } });
  return NextResponse.json(legajo);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();

  const data: Record<string, any> = {};
  const camposTexto = [
    "cuil", "apellido", "nombre", "condicion", "obraSocialId", "cbu", "bancoId", "motivoBaja",
    "tipoDocumento", "numeroDocumento", "sexo", "estadoCivil", "domicilio", "localidad", "provincia", "partido", "telefono", "email",
    "nivelEducativo", "tituloObtenido", "talleRopa", "talleCalzado",
    "fotoBase64", "modalidadContrato", "codigoArcaModalidad", "artNombre", "artPoliza",
  ];
  const camposFecha = ["fechaIngreso", "fechaEgreso", "fechaNacimiento", "antiguedadReconocida"];
  const camposRelacion = ["convenioId", "categoriaId", "centroCostoId", "sucursalId"];
  const camposBooleanos = ["afiliadoSindicato"];

  for (const c of camposTexto) if (body[c] !== undefined) data[c] = body[c] || null;
  for (const c of camposFecha) if (body[c] !== undefined) data[c] = body[c] ? new Date(body[c]) : null;
  for (const c of camposRelacion) if (body[c] !== undefined) data[c] = body[c] || null;
  for (const c of camposBooleanos) if (body[c] !== undefined) data[c] = Boolean(body[c]);
  if (body.numeroLegajo !== undefined) data.numeroLegajo = Number(body.numeroLegajo);

  try {
    const legajo = await prisma.legajo.update({ where: { id: params.id }, data });
    return NextResponse.json(legajo);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: `Ya existe un legajo con ese número en esta empresa.` }, { status: 409 });
    }
    throw e;
  }
}
