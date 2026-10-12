// FM RRHH — app/api/banco-horas/detectar/route.ts
// Las horas extra que surgen de la asistencia ya clasificada, día por día,
// para decidir si van al banco, se pagan o se descartan.
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina, fechaDesdeTexto } from "@/lib/ausencias-reglas";
import { detectarHorasExtra } from "@/lib/banco-horas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const p = new URL(req.url).searchParams;
    const desde = fechaDesdeTexto(p.get("desde")), hasta = fechaDesdeTexto(p.get("hasta"));
    if (!desde || !hasta || hasta < desde) return NextResponse.json({ error: "Elegí un rango de fechas válido." }, { status: 400 });
    if (hasta.getTime() - desde.getTime() > 62 * 24 * 3600 * 1000) return NextResponse.json({ error: "Buscá de a dos meses como máximo." }, { status: 400 });
    const hoy = hoyArgentina();
    return NextResponse.json(await detectarHorasExtra(empresa.id, desde, hasta < hoy ? hasta : hoy, hoy));
  } catch (e) {
    console.error("Error en GET /api/banco-horas/detectar:", e);
    return NextResponse.json({ error: "No se pudo revisar la asistencia." }, { status: 500 });
  }
}
