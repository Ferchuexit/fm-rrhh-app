// FM RRHH — app/api/turnos/asignaciones/route.ts
// Asigna un horario (o una rotación de varios) a una o más personas desde
// una fecha. No pisa el historial: cierra la asignación anterior el día
// antes, así la asistencia de fechas pasadas se sigue leyendo con el
// horario que valía entonces.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto, hoyArgentina } from "@/lib/ausencias-reglas";
import { avisar, avisoCambioDeHorario } from "@/lib/avisos";
import { largoDelCiclo, type Tramo } from "@/lib/turnos-reglas";

export const dynamic = "force-dynamic";
const DIA_MS = 24 * 3600 * 1000;
const MAX_ROTACION = 8;

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const desde = fechaDesdeTexto(body.desde);
    if (!desde) return NextResponse.json({ error: "Elegí desde qué fecha vale el horario." }, { status: 400 });
    const hoy = hoyArgentina();
    if (desde.getTime() < hoy.getTime() - 366 * DIA_MS || desde.getTime() > hoy.getTime() + 366 * DIA_MS) return NextResponse.json({ error: "La fecha tiene que estar dentro de un año hacia atrás o hacia adelante." }, { status: 400 });

    const legajoIds = [...new Set<string>((Array.isArray(body.legajoIds) ? body.legajoIds : []).map(String))];
    const horarioIds: string[] = (Array.isArray(body.horarioIds) ? body.horarioIds : []).map(String); // vacío = quitar el horario
    if (legajoIds.length === 0) return NextResponse.json({ error: "Elegí al menos una persona." }, { status: 400 });
    if (horarioIds.length > MAX_ROTACION) return NextResponse.json({ error: `Una rotación puede tener hasta ${MAX_ROTACION} semanas.` }, { status: 400 });

    const [legajos, elegidos] = await Promise.all([
      prisma.legajo.findMany({ where: { id: { in: legajoIds }, empresaId: empresa.id }, select: { id: true } }),
      prisma.horarioTrabajo.findMany({ where: { id: { in: [...new Set(horarioIds)] }, empresaId: empresa.id }, select: { id: true, ciclo: true } }),
    ]);
    const horarios = elegidos.length;
    if (legajos.length !== legajoIds.length) return NextResponse.json({ error: "Alguna de las personas elegidas no es de esta empresa o no la tenés asignada. Recargá la página." }, { status: 400 });
    if (horarios !== new Set(horarioIds).size) return NextResponse.json({ error: "Alguno de los horarios elegidos ya no existe. Recargá la página." }, { status: 400 });

    // Un esquema por ciclo ya trae su propia rotación adentro: no se mezcla
    // con la rotación semanal. Y necesita saber en qué día arranca.
    const deCiclo = elegidos.find((h) => Array.isArray(h.ciclo) && h.ciclo.length > 0);
    let diaDeCiclo = 1;
    if (deCiclo) {
      if (horarioIds.length > 1) return NextResponse.json({ error: "Un horario por ciclo (6×2, 4×4…) se asigna solo: ya rota por su cuenta. Quitá los otros." }, { status: 400 });
      const largo = largoDelCiclo(deCiclo.ciclo as unknown as Tramo[]);
      diaDeCiclo = Number(body.diaDeCiclo ?? 1);
      if (!Number.isInteger(diaDeCiclo) || diaDeCiclo < 1 || diaDeCiclo > largo) return NextResponse.json({ error: `Elegí en qué día del ciclo arranca (del 1 al ${largo}).` }, { status: 400 });
    }

    const vispera = new Date(desde.getTime() - DIA_MS);
    await prisma.$transaction([
      // lo que arrancaba desde esa fecha en adelante queda reemplazado
      prisma.asignacionHorario.deleteMany({ where: { legajoId: { in: legajoIds }, desde: { gte: desde } } }),
      // lo que venía de antes termina el día anterior
      prisma.asignacionHorario.updateMany({ where: { legajoId: { in: legajoIds }, desde: { lt: desde }, OR: [{ hasta: null }, { hasta: { gte: desde } }] }, data: { hasta: vispera } }),
      ...(horarioIds.length > 0 ? [prisma.asignacionHorario.createMany({ data: legajoIds.map((legajoId) => ({ legajoId, desde, horarioIds, diaDeCiclo, cargadoPor: sesion.email })) })] : []),
    ]);

    // Se avisa solo si el cambio es de acá en adelante y hay horario nuevo.
    if (horarioIds.length > 0 && desde >= hoy) await avisar(legajoIds, avisoCambioDeHorario(desde));
    return NextResponse.json({ ok: true, personas: legajoIds.length });
  } catch (e: any) {
    console.error("Error en POST /api/turnos/asignaciones:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo asignar el horario. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
