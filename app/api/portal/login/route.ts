// FM RRHH — app/api/portal/login/route.ts
// Ingreso del EMPLEADO al portal: CUIL (o DNI) + PIN de 6 números.
// Ruta pública (ver middleware.ts) — no usa ni toca la sesión del sistema.
//
// Mismo criterio que /api/login: mensaje genérico (no decir si el CUIL
// existe), y bloqueo de 15 minutos a los 5 intentos fallidos. Con un PIN
// de 6 números ese bloqueo no es un detalle: es lo que hace que adivinarlo
// lleve años en vez de minutos.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPassword } from "@/lib/auth";
import { cookieSesionPortal, interpretarIdentificacion, coincideIdentificacion, soloDigitos, MAX_INTENTOS_PIN, MINUTOS_BLOQUEO_PIN } from "@/lib/portal";

export const dynamic = "force-dynamic";

const ERROR_GENERICO = "Los datos no coinciden. Revisá tu CUIL y tu PIN, o pedile a RR.HH. que te genere un PIN nuevo.";
// Hash de relleno: si el CUIL no existe se compara igual contra esto, para
// que la respuesta tarde lo mismo y el tiempo no delate qué CUIL es válido.
const HASH_RELLENO = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8rT1bH0yN6l1bV3VZp8u2cQe0s2r8K";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ident = interpretarIdentificacion(body.cuil);
    const pin = soloDigitos(body.pin);
    if (!ident || !pin) {
      return NextResponse.json({ error: "Escribí tu CUIL (o DNI) y tu PIN." }, { status: 400 });
    }

    // El CUIL puede estar guardado con o sin guiones: se trae lo que
    // contenga el DNI y se compara normalizado.
    const dni = ident.tipo === "cuil" ? ident.valor.slice(2, 10) : ident.valor;
    const candidatos = (
      await prisma.accesoPortal.findMany({
        where: { activo: true, legajo: { cuil: { contains: dni.replace(/^0+/, "") } } },
        include: { legajo: true },
        orderBy: { legajo: { fechaIngreso: "desc" } },
      })
    ).filter((a) => coincideIdentificacion(a.legajo.cuil, ident));

    if (candidatos.length === 0) {
      await verificarPassword(pin, HASH_RELLENO);
      return NextResponse.json({ error: ERROR_GENERICO }, { status: 401 });
    }

    const ahora = new Date();
    const disponibles = candidatos.filter((a) => !a.bloqueadoHasta || a.bloqueadoHasta <= ahora);
    if (disponibles.length === 0) {
      const hasta = Math.max(...candidatos.map((a) => a.bloqueadoHasta!.getTime()));
      const minutos = Math.max(1, Math.ceil((hasta - ahora.getTime()) / 60000));
      return NextResponse.json({ error: `Demasiados intentos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.` }, { status: 429 });
    }

    // Lo normal es un solo candidato. Más de uno = la misma persona con
    // legajo en dos empresas: entra al que coincida con el PIN.
    let acceso = null;
    for (const a of disponibles) {
      if (await verificarPassword(pin, a.pinHash)) {
        acceso = a;
        break;
      }
    }

    if (!acceso) {
      for (const a of disponibles) {
        const intentos = a.intentosFallidos + 1;
        await prisma.accesoPortal.update({
          where: { id: a.id },
          data: {
            intentosFallidos: intentos >= MAX_INTENTOS_PIN ? 0 : intentos,
            bloqueadoHasta: intentos >= MAX_INTENTOS_PIN ? new Date(Date.now() + MINUTOS_BLOQUEO_PIN * 60000) : null,
          },
        });
      }
      return NextResponse.json({ error: ERROR_GENERICO }, { status: 401 });
    }

    await prisma.accesoPortal.update({
      where: { id: acceso.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoIngreso: ahora },
    });

    const res = NextResponse.json({ ok: true, debeCambiarPin: acceso.debeCambiarPin });
    res.cookies.set(
      await cookieSesionPortal({
        legajoId: acceso.legajoId,
        empresaId: acceso.legajo.empresaId,
        nombre: acceso.legajo.nombre,
        debeCambiarPin: acceso.debeCambiarPin,
      })
    );
    return res;
  } catch (e: any) {
    console.error("Error en POST /api/portal/login:", e);
    return NextResponse.json({ error: "No se pudo iniciar sesión. Probá de nuevo en un momento." }, { status: 500 });
  }
}
