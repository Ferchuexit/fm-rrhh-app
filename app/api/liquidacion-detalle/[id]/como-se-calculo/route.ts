import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formulaConValores } from "@/lib/motor/motor-reglas.mjs";
import { calcularAntiguedadAnios } from "@/lib/vacaciones";
import { calcularDiasTrabajadosEnPeriodo } from "@/lib/motor/prorrateo.mjs";
import { armarContextoTopes } from "@/lib/motor/parametros-topes.mjs";

// Conceptos que NO se calculan con una ReglaConcepto de convenio — tienen
// su propio motor dedicado (motor-ganancias.mjs / motor-embargos.mjs) o
// son insumos directos de una Novedad. Para estos, no tiene sentido
// buscar una "regla vigente desde" — se da una explicación distinta.
const EXPLICACION_ESPECIAL: Record<string, string> = {
  RETENCION_GANANCIAS: "Impuesto a las Ganancias — se calcula con el motor de Ganancias (acumulado del año, deducciones personales del mes, y la escala progresiva vigente), no con una fórmula de convenio. Ver /ganancias del legajo para el detalle del acumulado.",
  EMBARGO_JUDICIAL: "Embargo judicial — % dictado por el juez, aplicado sobre el neto del mes, sin fórmula de convenio de por medio.",
  EMBARGO_COMERCIAL: "Embargo comercial — importe cargado a mano para este mes específico, dentro del total de la deuda.",
  SAC: "Sueldo Anual Complementario — 50% de la mejor remuneración remunerativa del semestre, calculado automáticamente en el cierre de junio/diciembre.",
  SAC_PROPORCIONAL: "SAC Proporcional — igual que el SAC, pero prorrateado porque no se trabajó el semestre completo.",
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const detalle = await prisma.liquidacionDetalle.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        concepto: true,
        liquidacion: { include: { legajo: true, periodo: true, convenio: true } },
      },
    });

    const { liquidacion, concepto } = detalle;
    const legajo = liquidacion.legajo;
    const periodo = liquidacion.periodo;
    const convenioId = liquidacion.convenioId ?? legajo.convenioId;

    // ── Casos especiales: sin ReglaConcepto, motor dedicado ──
    if (EXPLICACION_ESPECIAL[concepto.codigo]) {
      return NextResponse.json({
        conceptoNombre: concepto.nombre,
        importe: detalle.importe,
        esCasoEspecial: true,
        explicacion: EXPLICACION_ESPECIAL[concepto.codigo],
      });
    }

    // ── Caso normal: buscar la ReglaConcepto vigente en la fecha exacta
    // del período (nunca la actual — las reglas se versionan por fecha y
    // nunca se editan en el lugar, así que esto es confiablemente
    // histórico). ──
    const regla = await prisma.reglaConcepto.findFirst({
      where: { conceptoId: detalle.conceptoId, convenioId: convenioId ?? undefined, vigenciaDesde: { lte: periodo.fechaDesde } },
      orderBy: { vigenciaDesde: "desc" },
    });

    if (!regla) {
      return NextResponse.json({
        conceptoNombre: concepto.nombre,
        importe: detalle.importe,
        esCasoEspecial: true,
        explicacion: "No se encontró una regla de convenio para este concepto en la fecha del período — puede ser un insumo directo cargado a mano.",
      });
    }

    // ── Reconstruir el contexto — MEJOR ESFUERZO, no el contexto exacto
    // que se usó en su momento (no se persiste completo). Se arma con:
    //   - conceptos: de las OTRAS líneas de ESTA MISMA liquidación (son
    //     los valores REALES que se guardaron, no una reconstrucción).
    //   - vars/topes/cantidades: recalculados con la lógica VIGENTE hoy —
    //     si el motor cambió desde que se hizo esta liquidación (ej. se
    //     agregó el prorrateo por alta/baja), puede no coincidir exacto
    //     con lo que se usó en el momento. Se avisa esto en la respuesta.
    const [otrasLineas, escala, parametrosVigentes, novedadesUsadas, valoresCategoriaVigentes] = await Promise.all([
      prisma.liquidacionDetalle.findMany({ where: { liquidacionId: liquidacion.id }, include: { concepto: true } }),
      prisma.escala.findFirst({ where: { categoriaId: legajo.categoriaId, vigenciaDesde: { lte: periodo.fechaDesde } }, orderBy: { vigenciaDesde: "desc" } }),
      prisma.parametroVigente.findMany(),
      prisma.liquidacionNovedad.findMany({ where: { liquidacionId: liquidacion.id }, include: { novedad: { include: { concepto: true } } } }),
      prisma.valorConceptoCategoria.findMany({ where: { categoriaId: legajo.categoriaId, vigenciaDesde: { lte: periodo.fechaDesde } }, orderBy: { vigenciaDesde: "desc" } }),
    ]);

    const conceptosContexto: Record<string, number> = {};
    for (const l of otrasLineas) conceptosContexto[l.concepto.codigo] = l.importe;

    const cantidades: Record<string, number> = {};
    for (const ln of novedadesUsadas) {
      const codigo = ln.novedad.concepto.codigo;
      cantidades[codigo] = (cantidades[codigo] ?? 0) + (ln.novedad.cantidad ?? 0);
    }

    const conceptosPorId = await prisma.concepto.findMany({ where: { id: { in: valoresCategoriaVigentes.map((v) => v.conceptoId) } } });
    const valoresCategoriaPorCodigo: Record<string, number> = {};
    for (const v of valoresCategoriaVigentes) {
      const c = conceptosPorId.find((c) => c.id === v.conceptoId);
      if (c && !(c.codigo in valoresCategoriaPorCodigo)) valoresCategoriaPorCodigo[c.codigo] = v.valor;
    }

    const clavesTopes = [...new Set(parametrosVigentes.map((p) => p.clave))];
    const { contexto: topes } = armarContextoTopes(clavesTopes, periodo.fechaDesde, parametrosVigentes as any);

    const diasDelPeriodo = Math.round((periodo.fechaHasta.getTime() - periodo.fechaDesde.getTime()) / (24 * 3600 * 1000)) + 1;
    const diasTrabajados = calcularDiasTrabajadosEnPeriodo({
      fechaDesdePeriodo: periodo.fechaDesde, fechaHastaPeriodo: periodo.fechaHasta,
      fechaIngresoLegajo: legajo.fechaIngreso, fechaEgresoLegajo: legajo.fechaEgreso,
    });
    const antiguedadAnios = calcularAntiguedadAnios(legajo.fechaIngreso, legajo.antiguedadReconocida, periodo.fechaDesde);

    const vars = {
      BASICO: escala?.basico ?? 0,
      VALOR_HORA: escala?.valorHora ?? 0,
      ANTIGUEDAD_ANIOS: Math.floor(antiguedadAnios),
      DIAS_TRABAJADOS: diasTrabajados,
      DIAS_MES: diasDelPeriodo,
      HORAS_TRABAJADAS: cantidades["HS_NORMALES"] ?? diasTrabajados * 8,
      AFILIADO_SINDICATO: legajo.afiliadoSindicato ? 1 : 0,
    };

    const contexto = {
      vars, conceptos: conceptosContexto, topes, cantidades,
      valoresCategoria: valoresCategoriaPorCodigo,
      remTotal: otrasLineas.filter((l) => l.concepto.tipo === "remunerativo").reduce((a, l) => a + l.importe, 0),
      noRemTotal: otrasLineas.filter((l) => l.concepto.tipo === "no_remunerativo").reduce((a, l) => a + l.importe, 0),
      conceptoActual: concepto.codigo,
    };

    let traza = "";
    try {
      traza = formulaConValores(regla.formula, contexto);
    } catch (e: any) {
      traza = `(No se pudo reconstruir la traza completa: ${e.message})`;
    }

    return NextResponse.json({
      conceptoNombre: concepto.nombre,
      importe: detalle.importe,
      esCasoEspecial: false,
      formula: regla.formula,
      formulaConValores: traza,
      convenioNombre: liquidacion.convenio?.nombre ?? "(sin convenio guardado en esta liquidación)",
      reglaVigenteDesde: regla.vigenciaDesde.toISOString().slice(0, 10),
      avisoReconstruccion: "Los valores de otros conceptos son los que realmente se guardaron. El básico, los topes y las cantidades se recalcularon con la lógica vigente HOY — si el motor cambió desde que se hizo esta liquidación, puede no coincidir exacto con lo que se usó en su momento.",
    });
  } catch (e: any) {
    console.error("Error en GET /api/liquidacion-detalle/[id]/como-se-calculo:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo reconstruir el cálculo." }, { status: 500 });
  }
}
