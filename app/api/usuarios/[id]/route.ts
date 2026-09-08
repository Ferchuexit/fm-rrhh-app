// FM RRHH — app/api/usuarios/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, obtenerSesionActual } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { nombre, rol, password } = await req.json();
    const sesion = await obtenerSesionActual();

    // No dejar que alguien se saque el rol admin a sí mismo por accidente
    // (o a propósito) y se quede sin forma de volver a entrar a esta pantalla.
    if (sesion?.id === params.id && rol && rol !== "admin") {
      const admins = await prisma.usuario.count({ where: { rol: "admin" } });
      if (admins <= 1) {
        return NextResponse.json({ error: "Sos el único admin — no podés sacarte ese rol a vos mismo." }, { status: 400 });
      }
    }

    const data: Record<string, any> = {};
    if (nombre !== undefined) data.nombre = nombre.trim();
    if (rol !== undefined) data.rol = rol;
    if (password) {
      if (password.length < 6) return NextResponse.json({ error: "La contraseña nueva tiene que tener al menos 6 caracteres." }, { status: 400 });
      data.passwordHash = await hashPassword(password);
    }

    const usuario = await prisma.usuario.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, nombre: true, rol: true, createdAt: true },
    });
    return NextResponse.json(usuario);
  } catch (e: any) {
    console.error("Error en PATCH /api/usuarios/[id]:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al editar el usuario." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const sesion = await obtenerSesionActual();

  if (sesion?.id === params.id) {
    return NextResponse.json({ error: "No podés eliminar tu propio usuario mientras estás logueado con él." }, { status: 400 });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: params.id } });
  if (usuario?.rol === "admin") {
    const admins = await prisma.usuario.count({ where: { rol: "admin" } });
    if (admins <= 1) {
      return NextResponse.json({ error: "No se puede eliminar al único admin que queda." }, { status: 400 });
    }
  }

  await prisma.usuario.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
