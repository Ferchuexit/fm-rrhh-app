// FM RRHH — app/api/asistencia/clasificar/route.ts
// Mismo motor y misma lógica que prisma/clasificar-asistencia.ts (CLI) —
// esta ruta existe para poder correrlo con un botón desde /asistencia en
// vez de la terminal. Si tocás la lógica de clasificación, tocala en los
// DOS lugares (o mejor: avisá para unificarlos en un solo módulo
// compartido la próxima vuelta).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { obtenerPeriodosCerrados, fechaEstaCerrada } from "@/lib/periodo-asistencia-lock";
import { clasificarDia, resolverTurno } from "@/lib/motor/motor-asistencia.mjs";

export async function POST(req: Request) {
  try {
    const { desde: desdeStr, hasta: hastaStr } = await req.json();
    if (!desdeStr || !hastaStr) {
      return NextResponse.json({ error: "Faltan desde/hasta." }, { status: 400 });
    }

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

    const desde = new Date(desdeStr + "T00:00:00.000Z");
    const hasta = new Date(hastaStr + "T00:00:00.000Z");

    const periodosCerrados = await obtenerPeriodosCerrados(empresa.id);

    const legajos = await prisma.legajo.findMany({
      where: { empresaId: empresa.id, condicion: "activo" },
      select: { id: true, convenioId: true, fichadaObligatoria: true },
    });

    const turnos = await prisma.turno.findMany();
    const fichadas = await prisma.fichada.findMany({ where: { fecha: { gte: desde, lte: hasta } } });

    const fichadasPorLegajoFecha = new Map<string, { hora: string }[]>();
    for (const f of fichadas) {
      const clave = `${f.legajoId}|${f.fecha.toISOString()}`;
      if (!fichadasPorLegajoFecha.has(clave)) fichadasPorLegajoFecha.set(clave, []);
      fichadasPorLegajoFecha.get(clave)!.push({ hora: f.hora });
    }

    let procesados = 0, saltadosPorManual = 0, saltadosPorCierre = 0;
    const contadorEstados: Record<string, number> = {};

    for (const legajo of legajos) {
      for (const d = new Date(desde); d <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
        const fecha = new Date(d);

        if (fechaEstaCerrada(fecha, periodosCerrados)) { saltadosPorCierre++; continue; }

        const existente = await prisma.asistenciaDia.findUnique({
          where: { legajoId_fecha: { legajoId: legajo.id, fecha } },
        });
        if (existente?.origen === "manual") { saltadosPorManual++; continue; }

        const turno = resolverTurno(fecha, legajo.id, legajo.convenioId, turnos as any);
        const clave = `${legajo.id}|${fecha.toISOString()}`;
        const fichadasDelDia = fichadasPorLegajoFecha.get(clave) ?? [];
        const diaSemana = fecha.getUTCDay();

        const resultado = clasificarDia(fichadasDelDia, turno, { diaSemana, fichadaObligatoria: legajo.fichadaObligatoria });

        await prisma.asistenciaDia.upsert({
          where: { legajoId_fecha: { legajoId: legajo.id, fecha } },
          create: {
            legajoId: legajo.id,
            fecha,
            estado: resultado.estado,
            horaIngresoReal: resultado.horaIngresoReal,
            horaEgresoReal: resultado.horaEgresoReal,
            minutosTarde: resultado.minutosTarde,
            minutosSalidaAnticipada: resultado.minutosSalidaAnticipada,
            origen: "automatico",
          },
          update: {
            estado: resultado.estado,
            horaIngresoReal: resultado.horaIngresoReal,
            horaEgresoReal: resultado.horaEgresoReal,
            minutosTarde: resultado.minutosTarde,
            minutosSalidaAnticipada: resultado.minutosSalidaAnticipada,
          },
        });

        procesados++;
        contadorEstados[resultado.estado] = (contadorEstados[resultado.estado] ?? 0) + 1;
      }
    }

    return NextResponse.json({ procesados, saltadosPorManual, saltadosPorCierre, contadorEstados });
  } catch (e: any) {
    console.error("Error en POST /api/asistencia/clasificar:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo clasificar." }, { status: 500 });
  }
}
