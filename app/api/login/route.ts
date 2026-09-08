import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPassword, firmarSesion, NOMBRE_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Faltan email y contraseña." }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !(await verificarPassword(password, usuario.passwordHash))) {
      // Mensaje genérico a propósito — no decir "el email no existe" vs
      // "la contraseña está mal" es lo que evita que alguien de afuera use
      // el propio formulario de login para descubrir qué emails son válidos.
      return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
    }

    const token = await firmarSesion(usuario);
    const res = NextResponse.json({ ok: true, nombre: usuario.nombre, rol: usuario.rol });
    res.cookies.set(NOMBRE_COOKIE, token, {
      httpOnly: true, // no accesible desde JS del navegador — reduce el riesgo de robo por XSS
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });
    return res;
  } catch (e: any) {
    console.error("Error en POST /api/login:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al iniciar sesión." }, { status: 500 });
  }
}
