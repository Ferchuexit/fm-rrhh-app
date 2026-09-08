// FM RRHH — app/api/exportar/lsd/route.ts
// Genera el TXT real de LSD con los datos ya liquidados y auditados. No
// inventa ningún dato faltante: si un concepto liquidado no tiene
// codigoArca asignado, la generación se aborta con la lista de qué falta.
// Ver 72-lsd-codigos-arca.md para el mapeo completo y qué está confirmado
// vs. provisorio.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LSD_V1 } from "@/lib/motor/lsd-v1.mjs";
import { generarArchivoLSD } from "@/lib/motor/motor-exportacion-lsd.mjs";
import { armarContextoTopes } from "@/lib/motor/parametros-topes.mjs";
import { calcularDiasTrabajadosEnPeriodo } from "@/lib/motor/prorrateo.mjs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  if (periodo.estado !== "cerrada") {
    return NextResponse.json(
      { error: `No se puede exportar el LSD: el período "${periodo.nombre}" no está cerrado (estado actual: "${periodo.estado}"). Cerralo primero en /auditoria.` },
      { status: 409 }
    );
  }
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: periodo.empresaId } });

  const liquidaciones = await prisma.liquidacion.findMany({
    where: { periodoId },
    include: { legajo: true, detalle: { include: { concepto: true } } },
  });

  if (liquidaciones.length === 0) {
    return NextResponse.json({ error: "Este período no tiene liquidaciones todavía. Liquidá primero en /liquidar." }, { status: 400 });
  }

  // Chequeo previo: todos los conceptos que SÍ van al LSD necesitan
  // codigoArca asignado (distinto de "numero", que es nuestra numeración
  // interna — el LSD necesita el código OFICIAL de ARCA).
  const codigosSinArca = new Set<string>();
  for (const liq of liquidaciones) {
    for (const d of liq.detalle) {
      if (d.concepto.tipo === "contribucion_patronal") continue;
      if (d.concepto.codigo === "HS_AUSENCIAS" || d.concepto.codigo === "HS_NORMALES") continue; // se manejan aparte
      if (!(d.concepto as any).codigoArca) codigosSinArca.add(d.concepto.codigo);
    }
  }
  if (codigosSinArca.size > 0) {
    return NextResponse.json(
      {
        error: "No se puede generar el LSD: hay conceptos liquidados sin código ARCA asignado.",
        conceptosFaltantes: [...codigosSinArca],
        solucion: "Corré prisma/mapear-codigos-arca.ts, o cargalo a mano en /conceptos.",
      },
      { status: 400 }
    );
  }

  // Novedades de horas (HS_NORMALES / HS_AUSENCIAS), y las escalas, para el
  // mecanismo especial de "Horas Normales" — ver 72-lsd-codigos-arca.md:
  // se reporta la hora NOMINAL completa (trabajadas + ausentes) en
  // crédito, y las ausencias aparte en débito — así ARCA ve la resta
  // explícita en vez de un número ya neteado.
  const legajoIds = liquidaciones.map((l) => l.legajoId);
  const novedadesHoras = await prisma.novedad.findMany({
    where: {
      legajoId: { in: legajoIds },
      periodo: { gte: periodo.fechaDesde, lte: periodo.fechaHasta },
      estado: "valida",
      concepto: { codigo: { in: ["HS_NORMALES", "HS_AUSENCIAS"] } },
    },
    include: { concepto: true },
  });
  const escalas = await prisma.escala.findMany({ where: { vigenciaDesde: { lte: periodo.fechaDesde } }, orderBy: { vigenciaDesde: "desc" } });

  const legajosCtx = liquidaciones.map((liq) => ({
    cuil: liq.legajo.cuil,
    legajo: String(liq.legajo.numeroLegajo),
    dependenciaRevista: "",
    cbu: liq.legajo.cbu ?? "",
    diasParaTope: 30,
    fechaPagoAAAAMMDD: `${periodo.fechaHasta.getFullYear()}${String(periodo.fechaHasta.getMonth() + 1).padStart(2, "0")}${String(periodo.fechaHasta.getDate()).padStart(2, "0")}`,
    fechaRubrica: "",
    formaDePago: "3",
  }));

  const conceptosPorLegajoCtx: any[] = [];

  for (const liq of liquidaciones) {
    // ── Mecanismo especial: Horas Normales + Ausencias ──
    const horasLegajo = novedadesHoras.filter((n) => n.legajoId === liq.legajoId);
    const horasNormales = horasLegajo.filter((n) => n.concepto.codigo === "HS_NORMALES").reduce((a, n) => a + (n.cantidad ?? 0), 0);
    const horasAusencias = horasLegajo.filter((n) => n.concepto.codigo === "HS_AUSENCIAS").reduce((a, n) => a + (n.cantidad ?? 0), 0);

    if (horasNormales > 0 || horasAusencias > 0) {
      const escala = escalas.find((e) => e.categoriaId === liq.legajo.categoriaId);
      const valorHora = escala?.valorHora ?? 0;
      const horasNominales = horasNormales + horasAusencias;
      conceptosPorLegajoCtx.push({
        cuil: liq.legajo.cuil,
        codigoConcepto: "110000",
        cantidad: horasNominales,
        unidades: "H", // 1 carácter — el campo del LSD no admite más. "H" de horas, provisorio sin confirmar contra ARCA.
        importe: horasNominales * valorHora,
        debitoCredito: "C",
        periodoAjuste: "",
      });
      if (horasAusencias > 0) {
        conceptosPorLegajoCtx.push({
          cuil: liq.legajo.cuil,
          codigoConcepto: "110000",
          cantidad: horasAusencias,
          unidades: "H",
          importe: horasAusencias * valorHora,
          debitoCredito: "D",
          periodoAjuste: "",
        });
      }
    }

    // ── El resto de los conceptos, con código ARCA real y Débito/Crédito
    // según el tipo (antes estaba fijo en "D" para todo, otro bug de
    // paso). REM_BASICA se salta acá si ya se reportó arriba como Horas
    // Normales (para no duplicarlo).
    for (const d of liq.detalle) {
      if (d.concepto.tipo === "contribucion_patronal") continue;
      if (d.concepto.codigo === "HS_AUSENCIAS" || d.concepto.codigo === "HS_NORMALES") continue;
      if (d.concepto.codigo === "REM_BASICA" && (horasNormales > 0 || horasAusencias > 0)) continue;

      conceptosPorLegajoCtx.push({
        cuil: liq.legajo.cuil,
        codigoConcepto: (d.concepto as any).codigoArca,
        cantidad: 0, // sin dato específico más allá de Horas Normales — ver 72-lsd-codigos-arca.md
        unidades: "",
        importe: Math.abs(d.importe),
        debitoCredito: d.concepto.tipo === "descuento" ? "D" : "C",
        periodoAjuste: "",
      });
    }
  }

  // ── Registro 4: datos del trabajador para el cálculo de la DJ F.931 ──
  // Faltaba por completo hasta ahora — encontrado al comparar contra la
  // especificación oficial vigente (LSDiseInterfazLiquidacion, 15/05/2026).
  //
  // Código de actividad y código de localidad NO tienen valor por
  // defecto a propósito (son tablas oficiales de ARCA, no algo que se
  // pueda adivinar) — si falta alguno, se aborta con la lista de qué
  // legajo lo necesita, mismo criterio que ya usa este archivo para los
  // códigos ARCA de conceptos.
  const legajosSinClasificacion: string[] = [];
  const legajosSinObraSocial: string[] = [];

  const cargasFamiliaVigentes = await prisma.cargaFamiliarGanancias.findMany({
    where: {
      legajoId: { in: legajoIds },
      vigenciaDesde: { lte: periodo.fechaDesde },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: periodo.fechaDesde } }],
    },
  });

  const parametrosVigentes = await prisma.parametroVigente.findMany();
  const clavesTopes = [...new Set(parametrosVigentes.map((p) => p.clave))];
  const { contexto: topes } = armarContextoTopes(clavesTopes, periodo.fechaDesde, parametrosVigentes as any);

  const diasDelPeriodo = Math.round((periodo.fechaHasta.getTime() - periodo.fechaDesde.getTime()) / (24 * 3600 * 1000)) + 1;

  const trabajadoresF931Ctx: any[] = [];

  for (const liq of liquidaciones) {
    const legajo = liq.legajo;

    if (!legajo.codigoActividad || !legajo.codigoLocalidad) {
      legajosSinClasificacion.push(`#${legajo.numeroLegajo} ${legajo.apellido}`);
      continue;
    }
    const codigoObraSocial = legajo.obraSocialId?.match(/^\d+/)?.[0];
    if (!codigoObraSocial) {
      legajosSinObraSocial.push(`#${legajo.numeroLegajo} ${legajo.apellido}`);
      continue;
    }

    const cargasDeEsteLegajo = cargasFamiliaVigentes.filter((c) => c.legajoId === legajo.id);
    const tieneConyuge = cargasDeEsteLegajo.some((c) => c.tipo === "conyuge");
    const cantidadHijos = cargasDeEsteLegajo.filter((c) => c.tipo === "hijo" || c.tipo === "hijo_incapacitado").length;

    const diasTrabajados = calcularDiasTrabajadosEnPeriodo({
      fechaDesdePeriodo: periodo.fechaDesde, fechaHastaPeriodo: periodo.fechaHasta,
      fechaIngresoLegajo: legajo.fechaIngreso, fechaEgresoLegajo: legajo.fechaEgreso,
    });

    const remunerativoTotal = liq.detalle.filter((d) => d.concepto.tipo === "remunerativo").reduce((a, d) => a + d.importe, 0);

    // Base 1/4 (aportes SIPA / obra social): topeadas, con el mismo piso
    // mínimo que ya aplica JUBILACION en /liquidar si trabajó el mes
    // completo. Base 2/3/5/8: sin tope.
    let baseTopeada = remunerativoTotal;
    if (topes.TOPE_JUBILATORIO !== undefined) {
      baseTopeada = Math.min(remunerativoTotal, topes.TOPE_JUBILATORIO);
      if (diasTrabajados >= diasDelPeriodo && topes.TOPE_JUBILATORIO_MINIMO !== undefined) {
        baseTopeada = Math.max(baseTopeada, topes.TOPE_JUBILATORIO_MINIMO);
      }
    }

    trabajadoresF931Ctx.push({
      cuil: legajo.cuil,
      tieneConyuge, cantidadHijos,
      codigoSituacionRevista: legajo.codigoSituacionRevista,
      codigoCondicion: legajo.codigoCondicion,
      codigoModalidadContrato: legajo.codigoModalidadContrato,
      codigoActividad: legajo.codigoActividad,
      codigoLocalidad: legajo.codigoLocalidad,
      codigoObraSocial,
      diasTrabajados,
      remuneracionBruta: liq.bruto,
      baseImponible1: baseTopeada,
      baseImponible2: remunerativoTotal,
      baseImponible3: remunerativoTotal,
      baseImponible4: baseTopeada,
      baseImponible5: remunerativoTotal,
      baseImponible8: remunerativoTotal, // simplificado: sin detracción Ley 27.430 (no construida) — ver comentario en lsd-v1.mjs
    });
  }

  if (legajosSinClasificacion.length > 0) {
    return NextResponse.json(
      {
        error: "No se puede generar el Registro 4 del LSD: faltan códigos de clasificación ARCA (actividad y/o localidad) en estos legajos.",
        legajosFaltantes: legajosSinClasificacion,
        solucion: "Cargalos en /legajos antes de exportar — son tablas oficiales de ARCA, no se pueden completar solos.",
      },
      { status: 400 }
    );
  }
  if (legajosSinObraSocial.length > 0) {
    return NextResponse.json(
      {
        error: "No se puede generar el Registro 4 del LSD: no se pudo extraer un código numérico de obra social de estos legajos.",
        legajosFaltantes: legajosSinObraSocial,
        solucion: "El campo Obra Social del legajo debe empezar con el código numérico (ej. '105804 - O.S. DE CHOFERES DE CAMIONES').",
      },
      { status: 400 }
    );
  }

  let resultado;
  try {
    resultado = generarArchivoLSD(LSD_V1, {
      empresa: { cuit: empresa.cuit.replace(/-/g, "") },
      periodo: { aaaammm: `${periodo.fechaDesde.getFullYear()}${String(periodo.fechaDesde.getMonth() + 1).padStart(2, "0")}` },
      legajos: legajosCtx,
      conceptosPorLegajo: conceptosPorLegajoCtx,
      trabajadoresF931: trabajadoresF931Ctx,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo generar el archivo LSD.", detalle: e.message }, { status: 400 });
  }

  return new NextResponse(resultado.contenido, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="LSD_${periodo.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.txt"`,
    },
  });
}
