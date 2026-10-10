import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarJefe } from "@/lib/equipo";

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

  // "Reporta a": el jefe tiene que ser de la misma empresa y no formar un
  // círculo (A reporta a B, B reporta a A).
  if (body.jefeId !== undefined) {
    data.jefeId = body.jefeId || null;
    if (data.jefeId) {
      const actual = await prisma.legajo.findUnique({ where: { id: params.id }, select: { empresaId: true } });
      if (!actual) return NextResponse.json({ error: "No se encontró el legajo." }, { status: 404 });
      const motivo = await validarJefe(actual.empresaId, params.id, data.jefeId);
      if (motivo) return NextResponse.json({ error: motivo }, { status: 400 });
    }
  }

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
