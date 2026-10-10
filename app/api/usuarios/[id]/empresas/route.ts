import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const empresas = await prisma.empresa.findMany({ orderBy: { razonSocial: "asc" }, select: { id: true, razonSocial: true, nombreFantasia: true } });
  const asignadas = await prisma.usuarioEmpresa.findMany({ where: { usuarioId: params.id }, select: { empresaId: true, rolId: true } });
  const porEmpresa = new Map(asignadas.map((a) => [a.empresaId, a]));
  return NextResponse.json(empresas.map((e) => ({ ...e, asignada: porEmpresa.has(e.id), rolId: porEmpresa.get(e.id)?.rolId ?? null })));
}

// Reemplaza la lista completa de empresas asignadas — más simple y menos
// propenso a errores que ir agregando/quitando de a una desde el cliente.
// Acepta `asignaciones: [{ empresaId, rolId }]` (rolId null = sin rol: el
// usuario conserva sus permisos de antes), y también el formato viejo
// `empresaIds`, que no trae rol.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const asignaciones: { empresaId: string; rolId: string | null }[] | null = Array.isArray(body.asignaciones)
      ? body.asignaciones.map((a: any) => ({ empresaId: String(a.empresaId), rolId: a.rolId ? String(a.rolId) : null }))
      : Array.isArray(body.empresaIds)
        ? body.empresaIds.map((empresaId: string) => ({ empresaId, rolId: null }))
        : null;
    if (!asignaciones) {
      return NextResponse.json({ error: "Falta la lista de empresas." }, { status: 400 });
    }

    const rolesPedidos = [...new Set(asignaciones.map((a) => a.rolId).filter(Boolean))] as string[];
    const existentes = await prisma.rol.count({ where: { id: { in: rolesPedidos } } });
    if (existentes !== rolesPedidos.length) return NextResponse.json({ error: "Alguno de los roles elegidos ya no existe. Recargá la página." }, { status: 400 });

    await prisma.$transaction([
      prisma.usuarioEmpresa.deleteMany({ where: { usuarioId: params.id } }),
      prisma.usuarioEmpresa.createMany({ data: asignaciones.map((a) => ({ usuarioId: params.id, empresaId: a.empresaId, rolId: a.rolId })) }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en PUT /api/usuarios/[id]/empresas:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo guardar el acceso a empresas." }, { status: 500 });
  }
}
