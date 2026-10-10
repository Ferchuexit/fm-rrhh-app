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

  try {
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
  } catch (e: any) {
    // Siempre JSON, nunca una respuesta vacía (la pantalla hace r.json()).
    // El caso típico: se bajó el código nuevo pero falta aplicar la
    // migración o regenerar el cliente de Prisma — se dice con todas las letras.
    console.error("Error en GET /api/legajo-digital:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022" || /does not exist|Cannot read properties of undefined|Unknown (arg|field)/i.test(String(e?.message));
    return NextResponse.json(
      { error: faltaBase
          ? "La base de datos o el cliente de Prisma no están actualizados para el legajo digital. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar."
          : `No se pudo cargar el legajo digital: ${e?.message ?? "error inesperado"}` },
      { status: 500 }
    );
  }
}
