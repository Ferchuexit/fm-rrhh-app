// FM RRHH — app/api/accesos-portal/avisos/route.ts
// Para RR.HH.: quién puede recibir avisos (acceso al portal, celulares con
// avisos activados, mail cargado) y qué avisos salieron últimamente.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { clavePublicaPush } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const legajoId = new URL(req.url).searchParams.get("legajoId");

    const [legajos, avisos] = await Promise.all([
      prisma.legajo.findMany({
        where: { empresaId: empresa.id, condicion: "activo" },
        select: { id: true, numeroLegajo: true, apellido: true, nombre: true, email: true, accesoPortal: { select: { activo: true, debeCambiarPin: true } }, suscripcionesPush: { select: { dispositivo: true, createdAt: true } } },
        orderBy: { numeroLegajo: "asc" },
      }),
      prisma.aviso.findMany({
        where: { legajo: { empresaId: empresa.id }, ...(legajoId ? { legajoId } : {}) },
        include: { legajo: { select: { numeroLegajo: true, apellido: true, nombre: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    return NextResponse.json({
      // Qué canales tiene configurados el sistema: si falta alguno, la
      // pantalla lo dice en vez de dejar adivinar por qué no llega nada.
      canales: { push: !!clavePublicaPush(), mail: !!process.env.RESEND_API_KEY },
      personas: legajos.map((l) => ({
        id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre,
        acceso: l.accesoPortal?.activo ? (l.accesoPortal.debeCambiarPin ? "pin_temporal" : "activo") : "sin_acceso",
        celulares: l.suscripcionesPush.map((s) => s.dispositivo ?? "Celular"),
        tieneMail: !!l.email,
      })),
      avisos,
    });
  } catch (e: any) {
    console.error("Error en GET /api/accesos-portal/avisos:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Avisos. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar los avisos." }, { status: 500 });
  }
}
