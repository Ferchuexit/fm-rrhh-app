// FM RRHH — app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { obtenerDatosDashboard } from "@/lib/dashboard-data";

export async function POST(req: Request) {
  try {
    const { periodoId } = await req.json();
    if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });
    const datos = await obtenerDatosDashboard(periodoId);
    return NextResponse.json(datos);
  } catch (e: any) {
    console.error("Error en POST /api/dashboard:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo cargar el dashboard." }, { status: 500 });
  }
}
