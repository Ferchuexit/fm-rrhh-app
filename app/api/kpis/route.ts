// FM RRHH — app/api/kpis/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  kpiHorasExtraPctMasa,
  kpiRotacionAnualizada,
  kpiTendenciaAusentismo,
  kpiPiramideAntiguedad,
  kpiCercaDePisoDeEscala,
  kpiProyeccionCostoLaboral,
} from "@/lib/motor/kpis-decision.mjs";

export async function POST(req: Request) {
  try {
    const { periodoId } = await req.json();
    if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });
    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
    const fechaReferencia = periodo.fechaDesde;
    const hoy = new Date();

    const legajos = await prisma.legajo.findMany({ where: { empresaId: periodo.empresaId } });
    const activos = legajos.filter((l) => l.condicion === "activo");

    const liquidaciones = await prisma.liquidacion.findMany({ where: { periodoId } });
    const bruto = liquidaciones.reduce((a, l) => a + l.bruto, 0);

    const detalles = await prisma.liquidacionDetalle.findMany({
      where: { liquidacion: { periodoId } },
      include: { concepto: true },
    });
    const liquidacionDetalle = detalles.map((d) => ({ conceptoCodigo: d.concepto.codigo, importe: d.importe }));

    // Rotación: solo se puede aproximar con lo que hay — "últimos 12 meses" desde hoy.
    const hace12Meses = new Date(hoy);
    hace12Meses.setMonth(hace12Meses.getMonth() - 12);
    const altasUltimos12Meses = legajos.filter((l) => l.fechaIngreso >= hace12Meses).length;
    const bajasUltimos12Meses = legajos.filter((l) => l.fechaEgreso && l.fechaEgreso >= hace12Meses).length;

    const escalas = await prisma.escala.findMany();
    const liquidacionesParaPiso = liquidaciones.map((l) => ({ legajoId: l.legajoId, bruto: l.bruto }));
    const legajosParaPiso = legajos.map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, categoriaId: l.categoriaId }));

    const resultado = {
      horasExtra: kpiHorasExtraPctMasa({ liquidacionDetalle, masaSalarial: bruto }),
      rotacion: kpiRotacionAnualizada({ altasUltimos12Meses, bajasUltimos12Meses, dotacionPromedio: activos.length }),
      // Solo hay un período real cargado hasta ahora — el motor ya sabe reportar
      // "datos insuficientes" en vez de inventar una tendencia con un solo punto.
      tendenciaAusentismo: kpiTendenciaAusentismo({ indiceAusentismoPorMes: [] }),
      piramide: kpiPiramideAntiguedad({ legajosActivos: activos, hoy: fechaReferencia }),
      cercaDePiso: kpiCercaDePisoDeEscala({ liquidaciones: liquidacionesParaPiso, legajos: legajosParaPiso, escalas }),
      proyeccion: kpiProyeccionCostoLaboral({ costoLaboralPorMes: [] }),
    };

    return NextResponse.json(resultado);
  } catch (e: any) {
    console.error("Error en POST /api/kpis:", e);
    return NextResponse.json({ error: e.message ?? "No se pudieron calcular los KPIs." }, { status: 500 });
  }
}
