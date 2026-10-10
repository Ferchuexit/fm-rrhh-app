// FM RRHH — app/api/roles/route.ts
// Roles configurables. Solo admin (lo garantiza el middleware: /api/roles
// está en RUTAS_SOLO_ADMIN) — quien define los roles define qué ve cada uno.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MODULOS, limpiarPermisos } from "@/lib/permisos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const roles = await prisma.rol.findMany({ orderBy: [{ predefinido: "desc" }, { nombre: "asc" }], include: { _count: { select: { asignaciones: true } } } });
    return NextResponse.json({
      modulos: MODULOS.map(({ clave, nombre, bloque, desc }) => ({ clave, nombre, bloque, desc })),
      roles: roles.map((r) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion, predefinido: r.predefinido, permisos: limpiarPermisos(r.permisos), enUso: r._count.asignaciones })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/roles:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022" || /does not exist|Cannot read properties of undefined/i.test(String(e?.message));
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Roles. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : `No se pudieron cargar los roles: ${e?.message ?? "error inesperado"}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nombre = String(body.nombre ?? "").trim().slice(0, 60);
    if (nombre.length < 3) return NextResponse.json({ error: "Ponele un nombre al rol." }, { status: 400 });
    const rol = await prisma.rol.create({ data: { nombre, descripcion: String(body.descripcion ?? "").trim().slice(0, 200) || null, permisos: limpiarPermisos(body.permisos) } });
    return NextResponse.json({ ok: true, id: rol.id });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe un rol con ese nombre." }, { status: 409 });
    console.error("Error en POST /api/roles:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo crear el rol." }, { status: 500 });
  }
}
