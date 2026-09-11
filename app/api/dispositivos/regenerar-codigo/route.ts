// FM RRHH — app/api/dispositivos/regenerar-codigo/route.ts
// Admin-only. Para cuando una terminal pierde su vinculación local (Safari
// en iOS a veces limpia localStorage) — antes la única opción era borrar
// el dispositivo entero (perdiendo sus fichadas), ahora se le puede dar
// un código nuevo sin tocar nada más.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarCodigoVinculacion } from "@/lib/fecha-argentina";

export async function POST(req: Request) {
  try {
    const { dispositivoId } = await req.json();
    if (!dispositivoId) return NextResponse.json({ error: "Falta dispositivoId." }, { status: 400 });

    let codigo = generarCodigoVinculacion();
    for (let intento = 0; intento < 5; intento++) {
      const existente = await prisma.dispositivoAsistencia.findUnique({ where: { codigoVinculacion: codigo } });
      if (!existente) break;
      codigo = generarCodigoVinculacion();
    }

    const actualizado = await prisma.dispositivoAsistencia.update({
      where: { id: dispositivoId },
      data: { codigoVinculacion: codigo, vinculado: false },
    });
    return NextResponse.json({ ok: true, codigo: actualizado.codigoVinculacion, nombre: actualizado.nombre });
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos/regenerar-codigo:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
