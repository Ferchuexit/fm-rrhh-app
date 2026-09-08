// FM RRHH — app/api/asistencia/kpis/route.ts
//
// GET ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&convenioId=X
//
// Todos los KPIs calculables con lo que hay en AsistenciaDia. Mismo rango
// y filtro de convenio que la grilla — para que "lo que ves" y "lo que
// mide" sea siempre lo mismo, sin sorpresas.
//
// Definiciones (documentadas acá porque cada una es una decisión, no un
// hecho obvio):
//   - "Días laborables" (denominador de ausentismo) = P+T+SA+A+AA+E+ES+AC+ACS+SUS
//     — todo día en que la persona TENÍA que estar disponible, haya venido
//     o no. Vacaciones (VC/VCS), feriado (F) y franco NO cuentan — esos días
//     no eran obligación de presentarse, así que no "cuentan en contra".
//   - "Ausentismo" = (A+AA+E+ES+AC+ACS+SUS) / días laborables.
//   - "Con aviso" solo se calcula sobre A+AA (feriado/enfermedad/ART no
//     aplican el concepto de aviso previo de la misma manera).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

const DIAS_LABORABLES_ESTADOS = ["P", "T", "SA", "A", "AA", "E", "ES", "AC", "ACS", "SUS"];
const DIAS_AUSENCIA_ESTADOS = ["A", "AA", "E", "ES", "AC", "ACS", "SUS"];
const DIAS_SEMANA_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const desdeStr = searchParams.get("desde");
    const hastaStr = searchParams.get("hasta");
    const convenioId = searchParams.get("convenioId");

    if (!desdeStr || !hastaStr) {
      return NextResponse.json({ error: "Faltan desde/hasta." }, { status: 400 });
    }
    const desde = new Date(desdeStr + "T00:00:00.000Z");
    const hasta = new Date(hastaStr + "T00:00:00.000Z");

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

    const legajos = await prisma.legajo.findMany({
      where: { empresaId: empresa.id, condicion: "activo", ...(convenioId ? { convenioId } : {}) },
      select: { id: true, numeroLegajo: true, apellido: true, nombre: true, convenio: { select: { nombre: true } } },
    });
    const legajoPorId = new Map(legajos.map((l) => [l.id, l]));

    const dias = await prisma.asistenciaDia.findMany({
      where: { legajoId: { in: legajos.map((l) => l.id) }, fecha: { gte: desde, lte: hasta } },
    });

    if (dias.length === 0) {
      return NextResponse.json({ sinDatos: true });
    }

    // ── Contadores por estado ──
    const contadorPorEstado: Record<string, number> = {};
    for (const d of dias) contadorPorEstado[d.estado] = (contadorPorEstado[d.estado] ?? 0) + 1;
    const contar = (estados: string[]) => estados.reduce((a, e) => a + (contadorPorEstado[e] ?? 0), 0);

    const diasLaborables = contar(DIAS_LABORABLES_ESTADOS);
    const diasAusencia = contar(DIAS_AUSENCIA_ESTADOS);
    const pctAusentismo = diasLaborables > 0 ? (diasAusencia / diasLaborables) * 100 : null;

    const diasPresentePuro = contadorPorEstado["P"] ?? 0;
    const diasTarde = contadorPorEstado["T"] ?? 0;
    const diasSalidaAnticipada = contadorPorEstado["SA"] ?? 0;
    const diasPresenteTotal = diasPresentePuro + diasTarde + diasSalidaAnticipada;

    const minutosTardeAcumulados = dias.filter((d) => d.estado === "T" && d.minutosTarde).reduce((a, d) => a + (d.minutosTarde ?? 0), 0);
    const minutosSalidaAcumulados = dias.filter((d) => d.estado === "SA" && d.minutosSalidaAnticipada).reduce((a, d) => a + (d.minutosSalidaAnticipada ?? 0), 0);

    const diasA = contadorPorEstado["A"] ?? 0;
    const diasAA = contadorPorEstado["AA"] ?? 0;
    const pctConAviso = diasA + diasAA > 0 ? (diasAA / (diasA + diasAA)) * 100 : null;

    const motivos = [
      { tipo: "Enfermedad", dias: contar(["E", "ES"]) },
      { tipo: "ART", dias: contar(["AC", "ACS"]) },
      { tipo: "Suspensión", dias: contadorPorEstado["SUS"] ?? 0 },
      { tipo: "Licencia paga", dias: contadorPorEstado["LP"] ?? 0 },
      { tipo: "Vacaciones", dias: contar(["VC", "VCS"]) },
      { tipo: "Feriado", dias: contadorPorEstado["F"] ?? 0 },
      { tipo: "Sábado trabajado", dias: contadorPorEstado["S"] ?? 0 },
    ].filter((m) => m.dias > 0);

    // ── Calidad de datos ──
    const legajosConImpar = new Set(dias.filter((d) => d.estado === "IMPAR").map((d) => d.legajoId));
    const legajosConSinTurno = new Set(dias.filter((d) => d.estado === "SIN_TURNO").map((d) => d.legajoId));

    // ── Ranking de ausencias por legajo (A+AA, sin licencias/ART/suspensión — es sobre falta lisa y llana) ──
    const ausenciasPorLegajo = new Map<string, number>();
    for (const d of dias) {
      if (d.estado === "A" || d.estado === "AA") {
        ausenciasPorLegajo.set(d.legajoId, (ausenciasPorLegajo.get(d.legajoId) ?? 0) + 1);
      }
    }
    const rankingAusencias = [...ausenciasPorLegajo.entries()]
      .map(([legajoId, diasAusente]) => {
        const l = legajoPorId.get(legajoId);
        return l ? { numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, dias: diasAusente } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.dias - a.dias)
      .slice(0, 10);

    // ── Ausentismo por día de semana ──
    const porDiaSemana = [1, 2, 3, 4, 5].map((diaSemana) => {
      const diasDeEseDia = dias.filter((d) => d.fecha.getUTCDay() === diaSemana && DIAS_LABORABLES_ESTADOS.includes(d.estado));
      const ausentesEseDia = diasDeEseDia.filter((d) => DIAS_AUSENCIA_ESTADOS.includes(d.estado));
      return {
        dia: DIAS_SEMANA_NOMBRE[diaSemana],
        pct: diasDeEseDia.length > 0 ? (ausentesEseDia.length / diasDeEseDia.length) * 100 : 0,
      };
    });

    // ── Por convenio (solo tiene sentido si no se filtró ya por uno) ──
    let porConvenio: { convenio: string; pct: number }[] | null = null;
    if (!convenioId) {
      const porConvenioMap = new Map<string, { laborables: number; ausencias: number }>();
      for (const d of dias) {
        const l = legajoPorId.get(d.legajoId);
        if (!l) continue;
        const nombreConvenio = l.convenio.nombre;
        if (!porConvenioMap.has(nombreConvenio)) porConvenioMap.set(nombreConvenio, { laborables: 0, ausencias: 0 });
        const entry = porConvenioMap.get(nombreConvenio)!;
        if (DIAS_LABORABLES_ESTADOS.includes(d.estado)) entry.laborables++;
        if (DIAS_AUSENCIA_ESTADOS.includes(d.estado)) entry.ausencias++;
      }
      porConvenio = [...porConvenioMap.entries()].map(([convenio, { laborables, ausencias }]) => ({
        convenio,
        pct: laborables > 0 ? (ausencias / laborables) * 100 : 0,
      }));
    }

    return NextResponse.json({
      sinDatos: false,
      totalLegajos: legajos.length,
      ausentismo: { pct: pctAusentismo, diasAusencia, diasLaborables },
      puntualidad: {
        diasPresenteTotal,
        diasPresentePuro,
        diasTarde,
        diasSalidaAnticipada,
        pctPuntual: diasPresenteTotal > 0 ? (diasPresentePuro / diasPresenteTotal) * 100 : null,
        promedioMinutosTarde: diasTarde > 0 ? Math.round(minutosTardeAcumulados / diasTarde) : null,
        promedioMinutosSalidaAnticipada: diasSalidaAnticipada > 0 ? Math.round(minutosSalidaAcumulados / diasSalidaAnticipada) : null,
      },
      aviso: { pctConAviso, diasA, diasAA },
      motivos,
      calidadDatos: {
        diasImpar: contadorPorEstado["IMPAR"] ?? 0,
        legajosConImpar: legajosConImpar.size,
        diasSinTurno: contadorPorEstado["SIN_TURNO"] ?? 0,
        legajosConSinTurno: legajosConSinTurno.size,
      },
      rankingAusencias,
      porDiaSemana,
      porConvenio,
    });
  } catch (e: any) {
    console.error("Error en GET /api/asistencia/kpis:", e);
    return NextResponse.json({ error: e.message ?? "No se pudieron calcular los KPIs." }, { status: 500 });
  }
}
