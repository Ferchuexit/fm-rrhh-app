import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limpiarPermisos, modulosIncompatiblesConSectores } from "@/lib/permisos";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const empresas = await prisma.empresa.findMany({ orderBy: { razonSocial: "asc" }, select: { id: true, razonSocial: true, nombreFantasia: true, centrosCosto: { select: { id: true, nombre: true }, orderBy: { nombre: "asc" } } } });
  const asignadas = await prisma.usuarioEmpresa.findMany({ where: { usuarioId: params.id }, select: { empresaId: true, rolId: true, sectores: true } });
  const porEmpresa = new Map(asignadas.map((a) => [a.empresaId, a]));
  return NextResponse.json(empresas.map((e) => ({ ...e, asignada: porEmpresa.has(e.id), rolId: porEmpresa.get(e.id)?.rolId ?? null, sectores: porEmpresa.get(e.id)?.sectores ?? [] })));
}

// Reemplaza la lista completa de empresas asignadas — más simple y menos
// propenso a errores que ir agregando/quitando de a una desde el cliente.
// Acepta `asignaciones: [{ empresaId, rolId, sectores }]` (rolId null = sin
// rol: el usuario conserva sus permisos de antes; sectores vacío = toda la
// empresa), y también el formato viejo `empresaIds`, que no trae rol.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const asignaciones: { empresaId: string; rolId: string | null; sectores: string[] }[] | null = Array.isArray(body.asignaciones)
      ? body.asignaciones.map((a: any) => ({ empresaId: String(a.empresaId), rolId: a.rolId ? String(a.rolId) : null, sectores: Array.isArray(a.sectores) ? [...new Set<string>(a.sectores.map(String))] : [] }))
      : Array.isArray(body.empresaIds)
        ? body.empresaIds.map((empresaId: string) => ({ empresaId, rolId: null, sectores: [] }))
        : null;
    if (!asignaciones) {
      return NextResponse.json({ error: "Falta la lista de empresas." }, { status: 400 });
    }

    const rolesPedidos = [...new Set(asignaciones.map((a) => a.rolId).filter(Boolean))] as string[];
    const roles = await prisma.rol.findMany({ where: { id: { in: rolesPedidos } }, select: { id: true, nombre: true, permisos: true } });
    const existentes = roles.length;

    // Limitar a sectores exige un rol de Gestión Humana: el filtro por
    // sector no alcanza a los totales de liquidación ni a los reportes.
    for (const a of asignaciones.filter((x) => x.sectores.length > 0)) {
      const rol = roles.find((r) => r.id === a.rolId);
      if (!rol) return NextResponse.json({ error: "Para limitar a un usuario a ciertos sectores hay que elegirle un rol en esa empresa (por ejemplo, Supervisor)." }, { status: 400 });
      const sobran = modulosIncompatiblesConSectores(limpiarPermisos(rol.permisos));
      if (sobran.length > 0) {
        return NextResponse.json({ error: `El rol "${rol.nombre}" no se puede combinar con sectores porque da acceso a: ${sobran.join(", ")}. Esas pantallas muestran datos de toda la empresa. Elegí un rol de Gestión Humana (por ejemplo, Supervisor) o quitale los sectores.` }, { status: 400 });
      }
      const validos = await prisma.centroCosto.count({ where: { id: { in: a.sectores }, empresaId: a.empresaId } });
      if (validos !== a.sectores.length) return NextResponse.json({ error: "Alguno de los sectores elegidos no es de esa empresa. Recargá la página." }, { status: 400 });
    }
    if (existentes !== rolesPedidos.length) return NextResponse.json({ error: "Alguno de los roles elegidos ya no existe. Recargá la página." }, { status: 400 });

    await prisma.$transaction([
      prisma.usuarioEmpresa.deleteMany({ where: { usuarioId: params.id } }),
      prisma.usuarioEmpresa.createMany({ data: asignaciones.map((a) => ({ usuarioId: params.id, empresaId: a.empresaId, rolId: a.rolId, sectores: a.sectores })) }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en PUT /api/usuarios/[id]/empresas:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo guardar el acceso a empresas." }, { status: 500 });
  }
}
