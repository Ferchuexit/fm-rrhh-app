// FM RRHH — app/api/legajos/[id]/biometria/route.ts
// Alta/revocación del registro biométrico — requiere sesión normal (esto
// se hace desde /legajos, no desde la terminal). El descriptor ya viene
// calculado del navegador (face-api.js corrió ahí) — acá solo se guarda.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const biometria = await prisma.biometriaEmpleado.findUnique({
    where: { legajoId: params.id },
    select: { estado: true, fechaAlta: true, fechaRevocacion: true, dispositivoAlta: { select: { nombre: true } } },
  });
  return NextResponse.json(biometria);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const { descriptor } = await req.json();
    if (!Array.isArray(descriptor) || descriptor.length < 64) {
      return NextResponse.json({ error: "El descriptor facial no tiene el formato esperado — probá capturar de nuevo." }, { status: 400 });
    }

    const legajo = await prisma.legajo.findUnique({ where: { id: params.id } });
    if (!legajo) return NextResponse.json({ error: "Legajo no encontrado." }, { status: 404 });

    // upsert manual — legajoId es @unique en BiometriaEmpleado, así que
    // "Actualizar registro" reemplaza el descriptor existente en vez de
    // crear una fila nueva en paralelo.
    const existente = await prisma.biometriaEmpleado.findUnique({ where: { legajoId: params.id } });
    const biometria = existente
      ? await prisma.biometriaEmpleado.update({
          where: { legajoId: params.id },
          data: { descriptor: JSON.stringify(descriptor), estado: "activo", fechaAlta: new Date(), fechaRevocacion: null },
        })
      : await prisma.biometriaEmpleado.create({
          data: { legajoId: params.id, descriptor: JSON.stringify(descriptor), estado: "activo" },
        });

    return NextResponse.json({ ok: true, id: biometria.id });
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/biometria:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al guardar el registro biométrico." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const existente = await prisma.biometriaEmpleado.findUnique({ where: { legajoId: params.id } });
    if (!existente) return NextResponse.json({ error: "Este legajo no tiene ningún registro biométrico." }, { status: 404 });

    // No se borra la fila — se revoca, para dejar registro de cuándo y
    // que no quede "reviviendo" si alguien reactiva algo sin querer.
    await prisma.biometriaEmpleado.update({
      where: { legajoId: params.id },
      data: { estado: "revocado", fechaRevocacion: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/legajos/[id]/biometria:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al revocar el registro." }, { status: 500 });
  }
}
