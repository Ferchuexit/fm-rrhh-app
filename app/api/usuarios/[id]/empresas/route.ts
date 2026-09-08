import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const empresas = await prisma.empresa.findMany({ orderBy: { razonSocial: "asc" }, select: { id: true, razonSocial: true, nombreFantasia: true } });
  const asignadas = await prisma.usuarioEmpresa.findMany({ where: { usuarioId: params.id }, select: { empresaId: true } });
  const idsAsignados = new Set(asignadas.map((a) => a.empresaId));
  return NextResponse.json(empresas.map((e) => ({ ...e, asignada: idsAsignados.has(e.id) })));
}

// Reemplaza la lista completa de empresas asignadas — más simple y menos
// propenso a errores que ir agregando/quitando de a una desde el cliente.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { empresaIds } = await req.json();
    if (!Array.isArray(empresaIds)) {
      return NextResponse.json({ error: "Falta la lista de empresas." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.usuarioEmpresa.deleteMany({ where: { usuarioId: params.id } }),
      prisma.usuarioEmpresa.createMany({ data: empresaIds.map((empresaId: string) => ({ usuarioId: params.id, empresaId })) }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en PUT /api/usuarios/[id]/empresas:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo guardar el acceso a empresas." }, { status: 500 });
  }
}
