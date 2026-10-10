// FM RRHH — app/api/legajo-digital/route.ts
// Lado RR.HH. del legajo digital: el checklist de toda la dotación activa
// y la bandeja de lo que espera revisión (documentos que subieron los
// empleados y cambios de datos que pidieron). Empresa actual, siempre.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { resumenEmpresa } from "@/lib/legajo-digital";

export const dynamic = "force-dynamic";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ legajos: [], documentos: [], cambios: [] });

  const selLegajo = { select: { numeroLegajo: true, apellido: true, nombre: true } };
  const [legajos, documentos, cambios] = await Promise.all([
    resumenEmpresa(empresa.id),
    prisma.documentoLegajo.findMany({
      where: { estado: "pendiente", legajo: { empresaId: empresa.id } },
      select: { id: true, tipo: true, nombre: true, tipoMime: true, fechaSubida: true, legajo: selLegajo },
      orderBy: { fechaSubida: "asc" },
    }),
    prisma.solicitudCambioDatos.findMany({ where: { estado: "pendiente", legajo: { empresaId: empresa.id } }, include: { legajo: selLegajo }, orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({ legajos, documentos, cambios });
}
