// FM RRHH — app/api/solicitudes/route.ts
// Bandeja de RR.HH.: pedidos de vacaciones/permisos de la empresa actual.
// (Fuera de /api/portal a propósito — esto lo usa quien opera el sistema.)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { saldoVacaciones } from "@/lib/ausencias";

export const dynamic = "force-dynamic";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ solicitudes: [] });

  const solicitudes = await prisma.solicitudAusencia.findMany({
    where: { legajo: { empresaId: empresa.id } },
    include: { legajo: { select: { numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } } } },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });

  // El saldo solo hace falta para decidir las pendientes de vacaciones.
  const conSaldo = await Promise.all(
    solicitudes.map(async (s) => ({
      ...s,
      saldo: s.estado === "pendiente" && s.tipo === "vacaciones" ? await saldoVacaciones(s.legajoId, s.fechaDesde.getUTCFullYear(), s.id) : null,
    }))
  );
  return NextResponse.json({ solicitudes: conSaldo });
}
