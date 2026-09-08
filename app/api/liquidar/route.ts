// FM RRHH — app/api/liquidar/route.ts
// Esto es lo que prueba que todo el proyecto encaja: lee legajos/escalas/reglas
// de una base real, llama a liquidarLegajo() (el mismo motor probado en
// test-motor-reglas.mjs, sin tocar una línea), y persiste el resultado.
//
// Acepta un filtro opcional (ver lib/liquidar-filtro.ts) — todos, por
// convenio, o por rango de legajo — para no tener que reliquidar a toda la
// empresa cada vez que se necesita reintentar unos pocos.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liquidarLegajo } from "@/lib/motor/motor-reglas.mjs";
import { armarContextoTopes } from "@/lib/motor/parametros-topes.mjs";
import { calcularRetencionGanancias, calcularDeduccionesGeneralesConTopes } from "@/lib/motor/motor-ganancias.mjs";
import { calcularTopeEmbargoComercial, procesarEmbargosDelLegajo } from "@/lib/motor/motor-embargos.mjs";
import { calcularDiasTrabajadosEnPeriodo } from "@/lib/motor/prorrateo.mjs";
import { obtenerSemestre, calcularSAC } from "@/lib/motor/motor-sac.mjs";
import { whereDeFiltro, type FiltroLegajos } from "@/lib/liquidar-filtro";
import { calcularAntiguedadAnios } from "@/lib/vacaciones";
import { obtenerSesionActual } from "@/lib/auth";

// Versión del motor — se sube a mano cuando un cambio en el motor pueda
// alterar el resultado de un cálculo (ej. la migración a Decimal). Sirve
// para, mirando una liquidación vieja, saber con qué "edición" del motor
// se calculó, sin tener que adivinar por la fecha.
const MOTOR_VERSION = "2.0.0"; // 2.0.0 = post-migración a Decimal (agosto 2026)

export async function POST(req: Request) {
  try {
    const { periodoId, filtro, motivo } = await req.json();

    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
    if (periodo.estado === "cerrada") {
      return NextResponse.json(
        { error: `El período "${periodo.nombre}" está cerrado — no se puede reliquidar sin querer. Si el cambio es intencional, reabrilo primero en /auditoria.` },
        { status: 409 }
      );
    }
    const fechaReferencia = periodo.fechaDesde;
    const fechaFinPeriodo = periodo.fechaHasta;
    const diasDelPeriodo = Math.round((fechaFinPeriodo.getTime() - fechaReferencia.getTime()) / (24 * 3600 * 1000)) + 1;

    const where = whereDeFiltro(periodo.empresaId, (filtro as FiltroLegajos) ?? { modo: "todos" }, periodo.convenioId);
    const legajos = await prisma.legajo.findMany({ where });
    const conceptos = await prisma.concepto.findMany();

    // ── Versionado e inmutabilidad ──
    const legajoIds = legajos.map((l) => l.id);
    const vigentesExistentes = await prisma.liquidacion.findMany({
      where: { periodoId, legajoId: { in: legajoIds }, vigente: true },
      include: { legajo: { select: { numeroLegajo: true, apellido: true } } },
    });
    if (periodo.fueCerradaAlgunaVez && vigentesExistentes.length > 0 && !motivo?.trim()) {
      return NextResponse.json(
        {
          error: `Este período ya estuvo cerrado alguna vez — ${vigentesExistentes.length} legajo(s) ya tienen una liquidación vigente. Esto sería una CORRECCIÓN, no una primera liquidación. Mandá un "motivo" explicando qué se corrige (ej. "Corrección de horas extra mal cargadas") para poder continuar.`,
          legajosYaLiquidados: vigentesExistentes.map((v) => `#${v.legajo.numeroLegajo} ${v.legajo.apellido}`),
        },
        { status: 409 }
      );
    }
    const vigentePorLegajoId = new Map(vigentesExistentes.map((v) => [v.legajoId, v]));
    const sesion = await obtenerSesionActual();

    const todosLosParametros = await prisma.parametroVigente.findMany();
    const clavesParametros = [...new Set(todosLosParametros.map((p) => p.clave))];
    const { contexto: topes, faltantes: parametrosFaltantes } = armarContextoTopes(clavesParametros, fechaReferencia, todosLosParametros as any);
    if (parametrosFaltantes.length > 0) {
      console.warn(`Parámetros sin vigencia para ${fechaReferencia.toISOString().substring(0, 10)}: ${parametrosFaltantes.join(", ")} — solo importa si alguna fórmula los usa.`);
    }

    const resultados = [];

    for (const legajo of legajos) {
      const escala = await prisma.escala.findFirst({
        where: {
          categoriaId: legajo.categoriaId,
          vigenciaDesde: { lte: fechaReferencia },
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
        },
        orderBy: { vigenciaDesde: "desc" },
      });
      if (!escala) {
        resultados.push({ legajoId: legajo.id, legajo: legajo.numeroLegajo, apellido: legajo.apellido, error: "No hay escala vigente para esta categoría en este período" });
        continue;
      }

      const reglasDb = await prisma.reglaConcepto.findMany({
        where: {
          convenioId: legajo.convenioId,
          vigenciaDesde: { lte: fechaReferencia },
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
        },
        include: { concepto: true },
      });
      const reglas = reglasDb.map((r) => ({
        conceptoCodigo: r.concepto.codigo,
        formula: r.formula,
        aporta: r.aporta,
        contribuye: r.contribuye,
      }));

      if (reglas.length === 0) {
        resultados.push({ legajoId: legajo.id, legajo: legajo.numeroLegajo, apellido: legajo.apellido, error: "Este convenio no tiene ninguna fórmula cargada todavía" });
        continue;
      }

      const antiguedadAnios = calcularAntiguedadAnios(legajo.fechaIngreso, legajo.antiguedadReconocida, fechaReferencia);

      const novedadesDelLegajo = await prisma.novedad.findMany({
        where: { legajoId: legajo.id, periodo: { gte: fechaReferencia, lte: fechaFinPeriodo }, estado: "valida" },
        include: { concepto: true },
      });

      const horasCargadas = novedadesDelLegajo
        .filter((n) => n.concepto.codigo === "HS_NORMALES")
        .reduce((a, n) => a + (n.cantidad ?? 0), 0);
      const hayHorasCargadas = novedadesDelLegajo.some((n) => n.concepto.codigo === "HS_NORMALES");

      const diasTrabajadosReales = calcularDiasTrabajadosEnPeriodo({
        fechaDesdePeriodo: fechaReferencia,
        fechaHastaPeriodo: fechaFinPeriodo,
        fechaIngresoLegajo: legajo.fechaIngreso,
        fechaEgresoLegajo: legajo.fechaEgreso,
      });
      const proporcionDelMes = diasDelPeriodo > 0 ? diasTrabajadosReales / diasDelPeriodo : 1;
      const basicoProrrateado = proporcionDelMes < 1 ? escala.basico * proporcionDelMes : escala.basico;

      const varsBase = {
        BASICO: basicoProrrateado,
        VALOR_HORA: escala.valorHora,
        ANTIGUEDAD_ANIOS: Math.floor(antiguedadAnios),
        DIAS_TRABAJADOS: diasTrabajadosReales,
        DIAS_MES: diasDelPeriodo,
        HORAS_TRABAJADAS: hayHorasCargadas ? horasCargadas : diasTrabajadosReales * 8,
        AFILIADO_SINDICATO: legajo.afiliadoSindicato ? 1 : 0,
      };

      const codigosConRegla = new Set(reglas.map((r) => r.conceptoCodigo));
      const insumosDirectos: Record<string, number> = {};
      const cantidadesPorConcepto: Record<string, number> = {};
      for (const n of novedadesDelLegajo) {
        if (n.concepto.codigo === "HS_NORMALES") continue;

        cantidadesPorConcepto[n.concepto.codigo] = (cantidadesPorConcepto[n.concepto.codigo] ?? 0) + (n.cantidad ?? 0);
        if (!codigosConRegla.has(n.concepto.codigo)) {
          let importe: number;
          if (n.concepto.unidad === "horas") {
            const multiplicador = n.concepto.codigo.includes("100") ? 2 : n.concepto.codigo.includes("50") ? 1.5 : 1;
            importe = (n.cantidad ?? 0) * varsBase.VALOR_HORA * multiplicador;
          } else {
            importe = n.valor ?? n.cantidad ?? 0;
          }
          insumosDirectos[n.concepto.codigo] = (insumosDirectos[n.concepto.codigo] ?? 0) + importe;
        }
      }

      const valoresCategoriaDb = await prisma.valorConceptoCategoria.findMany({
        where: {
          categoriaId: legajo.categoriaId,
          vigenciaDesde: { lte: fechaReferencia },
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
        },
        include: { concepto: true },
        orderBy: { vigenciaDesde: "desc" },
      });
      const valoresCategoria: Record<string, number> = {};
      for (const v of valoresCategoriaDb) {
        if (!(v.concepto.codigo in valoresCategoria)) valoresCategoria[v.concepto.codigo] = v.valor;
      }

      const fechaFinDeMes6o12 =
        (fechaFinPeriodo.getUTCMonth() === 5 && fechaFinPeriodo.getUTCDate() === 30) ||
        (fechaFinPeriodo.getUTCMonth() === 11 && fechaFinPeriodo.getUTCDate() === 31);

      if (fechaFinDeMes6o12) {
        try {
          const primeraPasada = liquidarLegajo({ varsBase, conceptos: conceptos as any, reglas, insumosDirectos, cantidades: cantidadesPorConcepto, valoresCategoria, topes });
          const remunerativoDeEsteMes = primeraPasada.remTotal;

          const semestre = obtenerSemestre(fechaFinPeriodo);
          const detallesDelSemestre = await prisma.liquidacionDetalle.findMany({
            where: {
              liquidacion: {
                legajoId: legajo.id, vigente: true,
                periodoId: { not: periodoId },
                periodo: { fechaDesde: { gte: semestre.desde, lte: semestre.hasta } },
              },
            },
            include: { concepto: true, liquidacion: { include: { periodo: true } } },
          });

          const remunerativoPorMes: Record<string, number> = {};
          for (const d of detallesDelSemestre) {
            if (d.concepto.tipo !== "remunerativo") continue;
            const p = d.liquidacion.periodo;
            const clave = `${p.fechaDesde.getUTCFullYear()}-${p.fechaDesde.getUTCMonth()}`;
            remunerativoPorMes[clave] = (remunerativoPorMes[clave] ?? 0) + d.importe;
          }
          const claveEsteMes = `${fechaReferencia.getUTCFullYear()}-${fechaReferencia.getUTCMonth()}`;
          remunerativoPorMes[claveEsteMes] = (remunerativoPorMes[claveEsteMes] ?? 0) + remunerativoDeEsteMes;

          const mejorRemuneracionMensual = Math.max(0, ...Object.values(remunerativoPorMes));

          const diasTrabajadosEnSemestre = calcularDiasTrabajadosEnPeriodo({
            fechaDesdePeriodo: semestre.desde, fechaHastaPeriodo: semestre.hasta,
            fechaIngresoLegajo: legajo.fechaIngreso, fechaEgresoLegajo: legajo.fechaEgreso,
          });
          const diasDelSemestre = Math.round((semestre.hasta.getTime() - semestre.desde.getTime()) / (24 * 3600 * 1000)) + 1;

          const importeSac = calcularSAC({
            mejorRemuneracionMensualDelSemestre: mejorRemuneracionMensual,
            diasTrabajadosEnSemestre, diasDelSemestre,
          });

          if (importeSac > 0) {
            const codigoSac = diasTrabajadosEnSemestre >= diasDelSemestre ? "SAC" : "SAC_PROPORCIONAL";
            insumosDirectos[codigoSac] = importeSac;
          }
        } catch (e: any) {
          console.error(`Error calculando SAC para legajo ${legajo.numeroLegajo}:`, e);
        }
      }

      let resultado;
      try {
        resultado = liquidarLegajo({ varsBase, conceptos: conceptos as any, reglas, insumosDirectos, cantidades: cantidadesPorConcepto, valoresCategoria, topes });
      } catch (e: any) {
        resultados.push({ legajoId: legajo.id, legajo: legajo.numeroLegajo, apellido: legajo.apellido, error: `Error en el motor de reglas: ${e.message}` });
        continue;
      }

      try {
        const anioActual = fechaReferencia.getUTCFullYear();
        const mesActual = fechaReferencia.getUTCMonth() + 1;

        const tablaMes = await prisma.tablaGananciasMensual.findUnique({
          where: { anio_mes: { anio: anioActual, mes: mesActual } },
          include: { tramos: true },
        });

        if (tablaMes) {
          const brutoDelMes = resultado.detalle
            .filter((d: any) => {
              const c = conceptos.find((c) => c.codigo === d.conceptoCodigo);
              return c && (c.tipo === "remunerativo" || c.tipo === "no_remunerativo");
            })
            .reduce((a: number, d: any) => a + d.importe, 0);

          const aportesDelMes = resultado.detalle
            .filter((d: any) => ["JUBILACION", "OBRA_SOCIAL", "LEY_19032"].includes(d.conceptoCodigo))
            .reduce((a: number, d: any) => a + d.importe, 0);

          const detallesAnioPrevio = await prisma.liquidacionDetalle.findMany({
            where: {
              liquidacion: {
                legajoId: legajo.id,
                vigente: true,
                periodoId: { not: periodoId },
                periodo: { fechaDesde: { gte: new Date(Date.UTC(anioActual, 0, 1)), lt: fechaReferencia } },
              },
            },
            include: { concepto: true },
          });

          const brutoAcumuladoPrevio = detallesAnioPrevio
            .filter((d) => d.concepto.tipo === "remunerativo" || d.concepto.tipo === "no_remunerativo")
            .reduce((a, d) => a + d.importe, 0);
          const aportesAcumuladoPrevio = detallesAnioPrevio
            .filter((d) => ["JUBILACION", "OBRA_SOCIAL", "LEY_19032"].includes(d.concepto.codigo))
            .reduce((a, d) => a + d.importe, 0);
          const retencionesPracticadasPrevias = detallesAnioPrevio
            .filter((d) => d.concepto.codigo === "RETENCION_GANANCIAS")
            .reduce((a, d) => a + d.importe, 0);

          const saldoInicial = await prisma.saldoInicialGanancias.findUnique({
            where: { legajoId_anio: { legajoId: legajo.id, anio: anioActual } },
          });

          const cargasVigentes = await prisma.cargaFamiliarGanancias.findMany({
            where: {
              legajoId: legajo.id,
              vigenciaDesde: { lte: fechaReferencia },
              OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
            },
          });
          const cargas = {
            conyuge: cargasVigentes.some((c) => c.tipo === "conyuge"),
            hijos: cargasVigentes.filter((c) => c.tipo === "hijo").length,
            hijosIncapacitados: cargasVigentes.filter((c) => c.tipo === "hijo_incapacitado").length,
          };

          const siradigVigentes = await prisma.deduccionSiradig.findMany({
            where: { legajoId: legajo.id, anio: anioActual, vigente: true },
          });
          const siradigPorTipo: Record<string, number> = {};
          for (const s of siradigVigentes) {
            siradigPorTipo[s.tipo] = (siradigPorTipo[s.tipo] ?? 0) + (s.montoAnual * mesActual) / 12;
          }
          const gananciaSujetaAAportesPrevia =
            (brutoAcumuladoPrevio + brutoDelMes + (saldoInicial?.brutoAcumuladoPrevio ?? 0)) -
            (aportesAcumuladoPrevio + aportesDelMes + (saldoInicial?.aportesAcumuladoPrevio ?? 0));
          const { total: deduccionesGeneralesAcumuladas } = calcularDeduccionesGeneralesConTopes({
            siradigPorTipo,
            ganNoImponibleAcum: tablaMes.ganNoImponibleAcum,
            gananciaSujetaAAportes: gananciaSujetaAAportesPrevia,
            mesActual,
          });

          const resultadoGanancias = calcularRetencionGanancias({
            gananciaBrutaAcumulada: brutoAcumuladoPrevio + brutoDelMes + (saldoInicial?.brutoAcumuladoPrevio ?? 0),
            aportesAcumulados: aportesAcumuladoPrevio + aportesDelMes + (saldoInicial?.aportesAcumuladoPrevio ?? 0),
            deduccionesGeneralesAcumuladas,
            cargas,
            retencionesPracticadasAcumuladas: retencionesPracticadasPrevias + (saldoInicial?.retencionAcumuladaPrevia ?? 0),
            tabla: tablaMes,
          });

          if (resultadoGanancias.retencionEsteMes > 0) {
            resultado.detalle.push({ conceptoCodigo: "RETENCION_GANANCIAS", importe: resultadoGanancias.retencionEsteMes });
            resultado.neto -= resultadoGanancias.retencionEsteMes;
          }
        }
      } catch (e: any) {
        console.error(`Error calculando Ganancias para legajo ${legajo.numeroLegajo}:`, e);
      }

      // ── Embargos ──
      const advertenciasEmbargo: string[] = [];
      try {
        const embargosActivos = await prisma.embargo.findMany({
          where: {
            legajoId: legajo.id, activo: true,
            fechaInicio: { lte: fechaFinPeriodo },
            OR: [{ fechaFin: null }, { fechaFin: { gte: fechaReferencia } }],
          },
        });

        const netoPreEmbargos = resultado.neto;
        const anioActualEmbargo = fechaReferencia.getUTCFullYear();
        const mesActualEmbargo = fechaReferencia.getUTCMonth() + 1;

        const embargosJudiciales = embargosActivos.filter((e) => e.tipo === "judicial" && e.porcentaje != null);

        let embargoComercialActivo: (typeof embargosActivos)[number] | null = null;
        let cuotaPendiente: { id: string; importe: number } | null = null;
        for (const embargo of embargosActivos.filter((e) => e.tipo === "comercial")) {
          const cuota = await prisma.cuotaEmbargo.findUnique({
            where: { embargoId_anio_mes: { embargoId: embargo.id, anio: anioActualEmbargo, mes: mesActualEmbargo } },
          });
          if (cuota && !cuota.aplicado) {
            embargoComercialActivo = embargo;
            cuotaPendiente = cuota;
            break;
          }
        }

        if (embargosJudiciales.length > 0 || cuotaPendiente) {
          const resultadoEmbargos = procesarEmbargosDelLegajo({
            netoPreEmbargos,
            embargosJudiciales: embargosJudiciales.map((e) => ({ porcentaje: e.porcentaje! })),
            embargoComercialSolicitado: cuotaPendiente?.importe ?? 0,
          });

          if (resultadoEmbargos.totalJudicial > 0) {
            resultado.detalle.push({ conceptoCodigo: "EMBARGO_JUDICIAL", importe: resultadoEmbargos.totalJudicial });
            resultado.neto -= resultadoEmbargos.totalJudicial;
          }

          if (resultadoEmbargos.comercialAplicado > 0 && embargoComercialActivo && cuotaPendiente) {
            if (topes.SMVM) {
              const tope = calcularTopeEmbargoComercial(resultado.bruto, topes.SMVM);
              if (cuotaPendiente.importe > tope) {
                advertenciasEmbargo.push(
                  `Embargo comercial "${embargoComercialActivo.descripcion}": la cuota de este mes ($${cuotaPendiente.importe.toFixed(2)}) supera el tope legal del Decreto 484/87 para este sueldo ($${tope.toFixed(2)}).`
                );
              }
            }

            resultado.detalle.push({ conceptoCodigo: "EMBARGO_COMERCIAL", importe: resultadoEmbargos.comercialAplicado });
            resultado.neto -= resultadoEmbargos.comercialAplicado;
            await prisma.cuotaEmbargo.update({ where: { id: cuotaPendiente.id }, data: { aplicado: true } });
          }

          advertenciasEmbargo.push(...resultadoEmbargos.advertencias);
        }
      } catch (e: any) {
        console.error(`Error calculando embargos para legajo ${legajo.numeroLegajo}:`, e);
      }

      // ── Versionado: crear la liquidación de este legajo ──
      const vigenteAnterior = vigentePorLegajoId.get(legajo.id);
      if (vigenteAnterior) {
        await prisma.liquidacion.update({ where: { id: vigenteAnterior.id }, data: { vigente: false } });
      }

      const liquidacion = await prisma.liquidacion.create({
        data: {
          periodoId,
          legajoId: legajo.id,
          convenioId: legajo.convenioId,
          version: (vigenteAnterior?.version ?? 0) + 1,
          vigente: true,
          motivo: vigenteAnterior ? (motivo?.trim() || null) : null,
          calculadoPor: sesion?.email ?? null,
          motorVersion: MOTOR_VERSION,
          bruto: resultado.bruto,
          neto: resultado.neto,
        },
      });

      if (novedadesDelLegajo.length > 0) {
        await prisma.liquidacionNovedad.createMany({
          data: novedadesDelLegajo.map((n: any) => ({ liquidacionId: liquidacion.id, novedadId: n.id })),
        });
      }

      const filasDetalle = resultado.detalle
        .map((d: any) => {
          const concepto = conceptos.find((c) => c.codigo === d.conceptoCodigo);
          return concepto ? { liquidacionId: liquidacion.id, conceptoId: concepto.id, importe: d.importe, formulaUsada: d.formula ?? null } : null;
        })
        .filter((f): f is { liquidacionId: string; conceptoId: string; importe: number; formulaUsada: string | null } => f !== null);
      if (filasDetalle.length > 0) {
        await prisma.liquidacionDetalle.createMany({ data: filasDetalle });
      }

      resultados.push({
        legajoId: legajo.id,
        legajo: legajo.numeroLegajo,
        apellido: legajo.apellido,
        bruto: resultado.bruto,
        neto: resultado.neto,
        detalle: resultado.detalle.map((d: any) => ({ concepto: d.nombre, importe: d.importe })),
        ...(advertenciasEmbargo.length > 0 ? { advertencias: advertenciasEmbargo } : {}),
      });
    }

    await prisma.periodo.update({ where: { id: periodoId }, data: { estado: "validada" } });

    return NextResponse.json({ periodo: periodo.nombre, legajosLiquidados: resultados.length, resultados });
  } catch (e: any) {
    console.error("Error en POST /api/:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al liquidar." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { periodoId, filtro } = await req.json();
    if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
    if (periodo.estado === "cerrada") {
      return NextResponse.json(
        { error: `El período "${periodo.nombre}" está cerrado — no se puede borrar nada sin querer. Reabrilo primero en /auditoria si es intencional.` },
        { status: 409 }
      );
    }
    const where = whereDeFiltro(periodo.empresaId, (filtro as FiltroLegajos) ?? { modo: "todos" }, periodo.convenioId);
    const legajos = await prisma.legajo.findMany({ where, select: { id: true } });
    const legajoIds = legajos.map((l) => l.id);

    const liquidaciones = await prisma.liquidacion.findMany({
      where: { periodoId, legajoId: { in: legajoIds } },
      select: { id: true },
    });
    const liquidacionIds = liquidaciones.map((l) => l.id);

    if (liquidacionIds.length > 0) {
      await prisma.$transaction([
        prisma.liquidacionDetalle.deleteMany({ where: { liquidacionId: { in: liquidacionIds } } }),
        prisma.liquidacionNovedad.deleteMany({ where: { liquidacionId: { in: liquidacionIds } } }),
        prisma.liquidacion.deleteMany({ where: { id: { in: liquidacionIds } } }),
      ]);
    }

    return NextResponse.json({ eliminadas: liquidacionIds.length });
  } catch (e: any) {
    console.error("Error en DELETE /api/liquidar:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al eliminar." }, { status: 500 });
  }
}
