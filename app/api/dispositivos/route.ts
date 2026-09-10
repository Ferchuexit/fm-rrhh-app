// FM RRHH — app/api/dispositivos/route.ts
// Admin-only, resuelto en middleware.ts (igual que /api/usuarios).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { generarCodigoVinculacion } from "@/lib/fecha-argentina";

// Un dispositivo se considera "online" si mandó un heartbeat en los
// últimos 5 minutos — umbral chico a propósito, para que el estado en
// pantalla refleje la realidad casi en el momento.
const MINUTOS_ONLINE = 5;

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });

  const dispositivos = await prisma.dispositivoAsistencia.findMany({
    where: { empresaId: empresa.id },
    orderBy: { createdAt: "desc" },
  });

  const limiteOnline = new Date(Date.now() - MINUTOS_ONLINE * 60000);
  const conEstado = dispositivos.map((d) => ({
    ...d,
    online: !!d.ultimaConexion && d.ultimaConexion >= limiteOnline,
  }));

  return NextResponse.json(conEstado);
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });

    const { nombre, ubicacion } = await req.json();
    if (!nombre?.trim()) return NextResponse.json({ error: "Falta el nombre del dispositivo." }, { status: 400 });

    // Reintenta si por pura casualidad el código de 6 dígitos ya está en
    // uso por otro dispositivo (posible, aunque improbable).
    let codigo = generarCodigoVinculacion();
    for (let intento = 0; intento < 5; intento++) {
      const existente = await prisma.dispositivoAsistencia.findUnique({ where: { codigoVinculacion: codigo } });
      if (!existente) break;
      codigo = generarCodigoVinculacion();
    }

    const dispositivo = await prisma.dispositivoAsistencia.create({
      data: { empresaId: empresa.id, nombre: nombre.trim(), ubicacion: ubicacion?.trim() || null, codigoVinculacion: codigo },
    });
    return NextResponse.json(dispositivo);
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al crear el dispositivo." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

    // Transacción: primero las fichadas que este dispositivo generó (para
    // no dejar filas huérfanas apuntando a un dispositivo que ya no
    // existe), después el dispositivo. Pensado para limpiar dispositivos
    // de PRUEBA — si un cliente real ya tiene fichadas de verdad
    // registradas con esta terminal, mejor desactivarla (activo=false vía
    // PATCH, todavía no armado) que borrarla y perder ese historial.
    await prisma.$transaction([
      prisma.fichada.deleteMany({ where: { dispositivoId: id } }),
      prisma.dispositivoAsistencia.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/dispositivos:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al eliminar el dispositivo." }, { status: 500 });
  }
}
