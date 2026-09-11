bash

cat /home/claude/work/app/api/empresas/actual/logo/route.ts
Salida

// FM RRHH — app/api/empresas/actual/logo/route.ts
// Admin-only (RUTAS_ADMIN en middleware.ts matchea el prefijo /api/empresas).
// A diferencia de los documentos de legajo (privados), este blob es
// PÚBLICO a propósito: la terminal de fichadas no tiene sesión y necesita
// poder mostrar la imagen directo con un <img src=...>.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { put } from "@vercel/blob";

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });

    const { contenidoBase64, tipoMime } = await req.json();
    if (!contenidoBase64) return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });

    const base64Limpio = contenidoBase64.includes(",") ? contenidoBase64.split(",")[1] : contenidoBase64;
    const buffer = Buffer.from(base64Limpio, "base64");
    if (buffer.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "La imagen pesa más de 2MB — usá una más chica." }, { status: 400 });
    }

    const blob = await put(`empresas/${empresa.id}/logo-${Date.now()}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: tipoMime ?? "image/png",
    });

    await prisma.empresa.update({ where: { id: empresa.id }, data: { logoUrl: blob.url } });
    return NextResponse.json({ ok: true, logoUrl: blob.url });
  } catch (e: any) {
    console.error("Error en POST /api/empresas/actual/logo:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al subir el logo." }, { status: 500 });
  }
}