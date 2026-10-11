// FM RRHH — app/api/agenda/route.ts
// La agenda de un mes de la empresa actual (?mes=2026-10).
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { agendaEmpresa, rangoDelMes, grillaDelMes } from "@/lib/agenda";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();
    const { desde, hasta, mes } = rangoDelMes(new URL(req.url).searchParams.get("mes"), hoy);
    // Se trae la grilla completa: los días de otros meses que completan las
    // semanas también muestran lo suyo.
    const semanas = grillaDelMes(desde, hasta);
    const items = await agendaEmpresa(empresa.id, semanas[0][0], semanas[semanas.length - 1][6]);
    return NextResponse.json({ mes, hoy, items });
  } catch (e) {
    console.error("Error en GET /api/agenda:", e);
    return NextResponse.json({ error: "No se pudo cargar la agenda. Probá de nuevo en un momento." }, { status: 500 });
  }
}
