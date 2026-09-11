// FM RRHH — app/api/dispositivos/legajos/route.ts
// Ruta PÚBLICA (ver middleware.ts) — la terminal no tiene sesión, así que
// no puede usar obtenerEmpresaActual() (que lee de la cookie de un
// usuario logueado). Acá la empresa sale del propio dispositivo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { dispositivoId } = await req.json();
    if (!dispositivoId) return NextResponse.json({ error: "Falta dispositivoId." }, { status: 400 });

    const dispositivo = await prisma.dispositivoAsistencia.findUnique({ where: { id: dispositivoId } });
    if (!dispositivo || !dispositivo.vinculado) return NextResponse.json({ error: "Dispositivo no reconocido." }, { status: 404 });

    const legajos = await prisma.legajo.findMany({
      where: { empresaId: dispositivo.empresaId, condicion: { notIn: ["inactivo", "baja"] } },
      select: { id: true, numeroLegajo: true, apellido: true, nombre: true, biometria: { select: { estado: true } } },
      orderBy: { numeroLegajo: "asc" },
    });
    return NextResponse.json(
      legajos.map((l) => ({
        id: l.id,
        numeroLegajo: l.numeroLegajo,
        apellido: l.apellido,
        nombre: l.nombre,
        biometriaActiva: l.biometria?.estado === "activo",
      }))
    );
  } catch (e: any) {
    console.error("Error en POST /api/dispositivos/legajos:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
