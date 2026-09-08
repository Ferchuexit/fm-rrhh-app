// FM RRHH — app/api/usuarios/route.ts
// El acceso admin-only se resuelve en middleware.ts, no acá — esta ruta ni
// se entera de si el que pregunta tiene permiso, porque si no lo tiene, la
// request nunca llega hasta acá.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";


// Sin esto, Next.js puede intentar generar esta ruta como página ESTÁTICA en
// el momento del build (congelada con lo que hubiera en la base ese día) en
// vez de ejecutarla fresca en cada visita — encontrado el 09/09/2026 al
// preparar el primer deploy a Vercel (/api/rangos rompía el build por esto).
export const dynamic = "force-dynamic";

export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, nombre: true, rol: true, createdAt: true }, // nunca se manda el passwordHash al cliente
  });
  return NextResponse.json(usuarios);
}

export async function POST(req: Request) {
  try {
    const { email, nombre, password, rol } = await req.json();
    if (!email?.trim() || !nombre?.trim() || !password || password.length < 6) {
      return NextResponse.json({ error: "Faltan email, nombre, o la contraseña tiene menos de 6 caracteres." }, { status: 400 });
    }

    const usuario = await prisma.usuario.create({
      data: {
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        passwordHash: await hashPassword(password),
        rol: rol || "operador",
      },
      select: { id: true, email: true, nombre: true, rol: true, createdAt: true },
    });
    return NextResponse.json(usuario);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese email." }, { status: 409 });
    }
    console.error("Error en POST /api/usuarios:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al crear el usuario." }, { status: 500 });
  }
}
