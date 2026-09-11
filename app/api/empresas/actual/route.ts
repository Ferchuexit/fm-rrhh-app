bash

cat /home/claude/work/app/api/empresas/actual/route.ts
Salida

// FM RRHH — app/api/empresas/actual/route.ts
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });
  return NextResponse.json({ id: empresa.id, razonSocial: empresa.razonSocial, logoUrl: empresa.logoUrl });
}