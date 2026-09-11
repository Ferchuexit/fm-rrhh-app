// FM RRHH — app/api/dispositivos/vincular/route.ts
//
// Ruta PÚBLICA a propósito (ver RUTAS_PUBLICAS en middleware.ts) — la
// terminal instalada en el cliente no tiene sesión de usuario, así que no
// puede pasar por el login normal. La seguridad acá es el código de 6
// dígitos de un solo uso: se genera al crear el dispositivo desde el panel
// admin, se invalida apenas se usa una vez.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { codigo } = await req.json();
    if (!codigo) return NextResponse.json({ error: "Falta el código." }, { status: 400 });

    const dispositivo = await prisma.dispositivoAsistencia.findUnique({ where: { codigoVinculacion: String(codigo).trim() }, include: { empresa: { select: { logoUrl: true } } } });
    if (!dispositivo) return NextResponse.json({ error: "Código inválido." }, { status: 404 });
    if (dispositivo.vinculado) return NextResponse.json({ error: "Ese código ya se usó — pedí uno nuevo desde el panel." }, { status: 409 });

    const actualizado = await prisma.dispositivoAsistencia.update({
      where: { id: dispositivo.id },
      data: { vinculado: true, ultimaConexion: new Date() },
    });

    // El id del dispositivo es lo que la terminal guarda localmente (ver
    // nota de diseño en el schema sobre por qué esto es suficiente para
    // esta etapa) y usa desde acá en más para heartbeat y fichadas.
    return NextResponse.json({ ok: true, dispositivoId: actualizado.id, nombre: actualizado.nombre, logoUrl: dispositivo.empresa.logoUrl });
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos/vincular:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al vincular." }, { status: 500 });
  }
}
