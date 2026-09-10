// FM RRHH — app/api/dispositivos/biometria/route.ts
// Ruta PÚBLICA (ver middleware.ts) — misma razón que /legajos: la terminal
// no tiene sesión. Devuelve los descriptores activos para que el
// reconocimiento corra en el navegador de la terminal, sin ida y vuelta al
// servidor por cada cara detectada (además, así funciona aunque se corte
// el internet un momento — el reconocimiento en sí no depende de la red).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { dispositivoId } = await req.json();
    if (!dispositivoId) return NextResponse.json({ error: "Falta dispositivoId." }, { status: 400 });

    const dispositivo = await prisma.dispositivoAsistencia.findUnique({ where: { id: dispositivoId } });
    if (!dispositivo || !dispositivo.vinculado) return NextResponse.json({ error: "Dispositivo no reconocido." }, { status: 404 });

    const registros = await prisma.biometriaEmpleado.findMany({
      where: { estado: "activo", legajo: { empresaId: dispositivo.empresaId } },
      select: { legajoId: true, descriptor: true, legajo: { select: { numeroLegajo: true, apellido: true, nombre: true } } },
    });

    return NextResponse.json(
      registros.map((r) => ({
        legajoId: r.legajoId,
        numeroLegajo: r.legajo.numeroLegajo,
        apellido: r.legajo.apellido,
        nombre: r.legajo.nombre,
        descriptor: JSON.parse(r.descriptor) as number[],
      }))
    );
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos/biometria:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
