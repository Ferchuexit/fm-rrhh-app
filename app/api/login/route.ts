import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPassword, firmarSesion, NOMBRE_COOKIE } from "@/lib/auth";

// FM RRHH — app/api/login/route.ts
//
// Bloqueo por fuerza bruta agregado el 09/09/2026, antes de hacer pública
// la URL — sin esto, no había ningún límite a cuántas contraseñas se
// podían probar contra este endpoint. 5 intentos fallidos → 15 minutos de
// bloqueo, contado por usuario (no por IP — más simple, y alcanza para
// este caso: pocos usuarios, todos conocidos).
//
// El mensaje sigue siendo genérico también cuando está bloqueado — no
// decimos "tu cuenta está bloqueada" antes de haber confirmado que el
// email existe, por la misma razón que el mensaje de error normal es
// genérico: no darle a alguien de afuera una forma de confirmar qué
// emails son válidos.
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Faltan email y contraseña." }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (usuario?.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutosRestantes = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Demasiados intentos — probá de nuevo en ${minutosRestantes} minuto${minutosRestantes === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    if (!usuario || !(await verificarPassword(password, usuario.passwordHash))) {
      if (usuario) {
        const nuevosIntentos = usuario.intentosFallidos + 1;
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            intentosFallidos: nuevosIntentos,
            bloqueadoHasta: nuevosIntentos >= MAX_INTENTOS ? new Date(Date.now() + MINUTOS_BLOQUEO * 60000) : null,
          },
        });
      }
      // Mensaje genérico a propósito — no decir "el email no existe" vs
      // "la contraseña está mal" es lo que evita que alguien de afuera use
      // el propio formulario de login para descubrir qué emails son válidos.
      return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
    }

    if (usuario.intentosFallidos > 0) {
      await prisma.usuario.update({ where: { id: usuario.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
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
