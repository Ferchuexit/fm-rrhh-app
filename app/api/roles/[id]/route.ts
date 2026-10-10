// FM RRHH — app/api/roles/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limpiarPermisos, modulosIncompatiblesConSectores } from "@/lib/permisos";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, any> = {};
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim().slice(0, 60);
      if (nombre.length < 3) return NextResponse.json({ error: "Ponele un nombre al rol." }, { status: 400 });
      data.nombre = nombre;
    }
    if (body.descripcion !== undefined) data.descripcion = String(body.descripcion).trim().slice(0, 200) || null;
    if (body.permisos !== undefined) {
      data.permisos = limpiarPermisos(body.permisos);
      // Si este rol lo tiene alguien limitado a sectores, no se le pueden
      // sumar módulos que muestran datos de toda la empresa.
      const sobran = modulosIncompatiblesConSectores(data.permisos);
      if (sobran.length > 0) {
        const limitados = await prisma.usuarioEmpresa.count({ where: { rolId: params.id, NOT: { sectores: { isEmpty: true } } } });
        if (limitados > 0) {
          return NextResponse.json({ error: `Este rol lo tienen ${limitados} usuario(s) limitados a ciertos sectores, y no se puede combinar con: ${sobran.join(", ")}. Quitales los sectores en Usuarios, o armá otro rol para quienes ven toda la empresa.` }, { status: 409 });
        }
      }
    }
    await prisma.rol.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe un rol con ese nombre." }, { status: 409 });
    if (e.code === "P2025") return NextResponse.json({ error: "Ese rol ya no existe." }, { status: 404 });
    console.error("Error en PATCH /api/roles/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo guardar el rol." }, { status: 500 });
  }
}

// No se borra un rol que alguien tiene asignado: esos usuarios pasarían en
// silencio a "sin rol", que para un operador es MÁS acceso, no menos.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const rol = await prisma.rol.findUnique({ where: { id: params.id }, include: { _count: { select: { asignaciones: true } } } });
    if (!rol) return NextResponse.json({ error: "Ese rol ya no existe." }, { status: 404 });
    if (rol.predefinido) return NextResponse.json({ error: "Los roles que vienen armados no se eliminan (sí se pueden editar)." }, { status: 400 });
    if (rol._count.asignaciones > 0) return NextResponse.json({ error: `Este rol está asignado a ${rol._count.asignaciones} usuario(s). Cambiáselo primero en Usuarios.` }, { status: 409 });
    await prisma.rol.delete({ where: { id: rol.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/roles/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo eliminar el rol." }, { status: 500 });
  }
}
