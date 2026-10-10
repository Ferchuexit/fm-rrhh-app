// FM RRHH — app/api/vacaciones/planificacion/route.ts
// Entre dos fechas: cuánta gente hay afuera (firme y contando pedidos sin
// responder) y cuánto cuesta el rango. Los importes solo se devuelven a
// quien puede ver liquidaciones: un supervisor planifica vacaciones sin
// enterarse de los sueldos.
import { NextResponse } from "next/server";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { permisosActuales } from "@/lib/permisos-servidor";
import { fechaDesdeTexto, diasCorridos } from "@/lib/ausencias-reglas";
import { planificar } from "@/lib/planificacion";

export const dynamic = "force-dynamic";
const MAX_DIAS = 366;

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const quien = await permisosActuales();
    if (!empresa || !quien) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const desde = fechaDesdeTexto(searchParams.get("desde"));
    const hasta = fechaDesdeTexto(searchParams.get("hasta"));
    if (!desde || !hasta) return NextResponse.json({ error: "Completá las dos fechas." }, { status: 400 });
    if (hasta < desde) return NextResponse.json({ error: "La fecha 'hasta' no puede ser anterior a 'desde'." }, { status: 400 });
    if (diasCorridos(desde, hasta) > MAX_DIAS) return NextResponse.json({ error: "El rango no puede superar un año." }, { status: 400 });

    const conCostos = quien.esAdmin || !!quien.permisos?.liquidaciones;
    return NextResponse.json(await planificar(empresa.id, { desde, hasta }, searchParams.get("centroCostoId") || null, conCostos));
  } catch (e: any) {
    console.error("Error en GET /api/vacaciones/planificacion:", e);
    return NextResponse.json({ error: "No se pudo calcular la planificación. Probá de nuevo en un momento." }, { status: 500 });
  }
}
