// FM RRHH — app/api/celebraciones/route.ts
// Cumpleaños y aniversarios de los próximos días, para RR.HH. Acá sí salen
// todos (también quien pidió no mostrar su cumpleaños a los compañeros, con
// la marca), pero nunca la edad.
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { personasConFechas, celebraciones } from "@/lib/cultura";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const dias = Math.min(366, Math.max(0, Number(new URL(req.url).searchParams.get("dias") ?? 60) || 60));
    const personas = await personasConFechas(empresa.id);
    const reservados = new Set(personas.filter((p) => p.ocultarCumple).map((p) => p.id));
    return NextResponse.json({
      hoy: hoyArgentina(), dias, sinFecha: personas.filter((p) => !p.fechaNacimiento).map((p) => `${p.nombre} ${p.apellido}`),
      celebraciones: celebraciones(personas, hoyArgentina(), dias, false).map(({ jefeId, ...c }) => ({ ...c, reservado: c.tipo === "cumple" && reservados.has(c.legajoId) })),
    });
  } catch (e) {
    console.error("Error en GET /api/celebraciones:", e);
    return NextResponse.json({ error: "No se pudieron cargar los festejos. Probá de nuevo en un momento." }, { status: 500 });
  }
}
