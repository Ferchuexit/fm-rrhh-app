// FM RRHH — app/api/exportar/f931/route.ts
// A diferencia de LSD, esto NO es un archivo de formato fijo — es el
// consolidado por CUIL para transcribir al portal "Declaración en Línea" de
// ARCA, tal como se documentó en 07-motor-exportacion-arca.md: el Excel
// original tampoco generaba un TXT de F.931.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consolidarF931, aCSV } from "@/lib/motor/f931-consolidado.mjs";
import { obtenerParametroVigente } from "@/lib/motor/parametros-topes.mjs";

// Cada columna del F.931 se arma sumando LiquidacionDetalle por el código de
// concepto correspondiente — NO se recalcula ningún porcentaje acá. Si mañana
// cambia una tasa (o Moras cambia de ART), se edita la fórmula en /reglas y el
// F.931 automáticamente declara lo que efectivamente se liquidó, sin que haya
// que tocar este archivo. Ver nota arquitectónica en f931-consolidado.mjs.
const CODIGO_APORTE_JUBILACION = "JUBILACION"; // descuento del empleado, 11%
const CODIGO_APORTE_LEY19032 = "LEY_19032"; // descuento del empleado, 3%
const CODIGO_APORTE_OBRA_SOCIAL = "OBRA_SOCIAL"; // descuento del empleado, 3%
const CODIGO_CONTRIB_JUBILACION = "CONTRIB_JUBILACION"; // contribución patronal, 18% (SIPA/INSSJP/FNE/AAFF)
const CODIGO_CONTRIB_OBRA_SOCIAL = "CONTRIB_OBRA_SOCIAL"; // contribución patronal, 6%
const CODIGO_CONTRIB_ART = "CONTRIB_ART"; // contribución patronal, 3,1211%
const CODIGO_CONTRIB_SEGURO_VIDA = "CONTRIB_SEGURO_VIDA"; // contribución patronal, solo Madera, 1,6%
const CODIGO_CUOTA_SINDICAL = "SINDICATO"; // descuento del empleado

function sumarPorConcepto(detalle: { importe: number; concepto: { codigo: string } }[], codigo: string): number {
  return detalle.filter((d) => d.concepto.codigo === codigo).reduce((a, d) => a + d.importe, 0);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  if (periodo.estado !== "cerrada") {
    return NextResponse.json(
      { error: `No se puede exportar el F.931: el período "${periodo.nombre}" no está cerrado (estado actual: "${periodo.estado}"). Cerralo primero en /auditoria.` },
      { status: 409 }
    );
  }
  const fechaReferencia = periodo.fechaDesde;

  const liquidaciones = await prisma.liquidacion.findMany({
    where: { periodoId },
    include: { legajo: { include: { categoria: true, convenio: true } }, detalle: { include: { concepto: true } } },
  });

  if (liquidaciones.length === 0) {
    return NextResponse.json({ error: "Este período no tiene liquidaciones todavía. Liquidá primero en /legajos." }, { status: 400 });
  }

  const legajos = liquidaciones.map((liq) => ({
    legajo: liq.legajo.numeroLegajo,
    cuil: liq.legajo.cuil,
    apellidoNombre: `${liq.legajo.apellido}, ${liq.legajo.nombre}`,
    categoria: liq.legajo.categoria.nombre,
  }));

  // "fuente" ahora se deriva del convenio real del legajo, no se hardcodea
  // más a "mensualComercio" para todos — así un empleado de Madera aparece
  // en la columna correcta. Sigue siendo una simplificación: dentro de un
  // mismo convenio no distinguimos quincena/mes/vacaciones/liquidación
  // final (el schema no tiene ese dato hoy, y "Excluidos" también cae en
  // "mensualComercio" por no tener columna propia), pero al menos no se
  // mezclan Madera y el resto en una sola columna.
  const remuneracionesPorFuente = liquidaciones.map((liq) => {
    const importeRemunerativo = liq.detalle
      .filter((d) => d.concepto.tipo === "remunerativo")
      .reduce((a, d) => a + d.importe, 0);
    const fuente = liq.legajo.convenio.codigo === "0335/75" ? "quincenalMadera" : "mensualComercio";
    return { cuil: liq.legajo.cuil, fuente: fuente as "quincenalMadera" | "mensualComercio", importe: importeRemunerativo };
  });

  const noRemunerativoPorCuil = liquidaciones.map((liq) => ({
    cuil: liq.legajo.cuil,
    importe: liq.detalle.filter((d) => d.concepto.tipo === "no_remunerativo").reduce((a, d) => a + d.importe, 0),
  }));

  // Acá está el cambio central: cada monto sale de sumar LiquidacionDetalle
  // por concepto — lo mismo que ya se ve en el recibo de cada empleado — no
  // de aplicar un porcentaje de nuevo. Si el recibo dice $X de Jubilación,
  // el F.931 dice el mismo $X.
  const montosPorCuil = new Map(
    liquidaciones.map((liq) => [
      liq.legajo.cuil,
      {
        aporteJubilacion11: sumarPorConcepto(liq.detalle, CODIGO_APORTE_JUBILACION),
        aporteLey19032_3: sumarPorConcepto(liq.detalle, CODIGO_APORTE_LEY19032),
        aporteObraSocial3: sumarPorConcepto(liq.detalle, CODIGO_APORTE_OBRA_SOCIAL),
        contribPatronalSipa: sumarPorConcepto(liq.detalle, CODIGO_CONTRIB_JUBILACION),
        contribPatronalObraSocial6: sumarPorConcepto(liq.detalle, CODIGO_CONTRIB_OBRA_SOCIAL),
        art: sumarPorConcepto(liq.detalle, CODIGO_CONTRIB_ART),
        contribSeguroVida: sumarPorConcepto(liq.detalle, CODIGO_CONTRIB_SEGURO_VIDA),
        cuotaSindical: sumarPorConcepto(liq.detalle, CODIGO_CUOTA_SINDICAL),
      },
    ])
  );

  const parametrosVigentes = await prisma.parametroVigente.findMany();
  const topeParam = obtenerParametroVigente("TOPE_JUBILATORIO", fechaReferencia, parametrosVigentes as any);
  const topeBaseImponible = topeParam ? Number(topeParam.valor) : 999999999; // sin tope real cargado → columna informativa sin techo, con nota abajo

  const filas = consolidarF931(legajos, remuneracionesPorFuente, noRemunerativoPorCuil, montosPorCuil, topeBaseImponible);

  const csv = aCSV(filas);
  const notas: string[] = [];
  if (!topeParam) {
    notas.push(
      "No había un TOPE_JUBILATORIO vigente cargado en /parametros para este período — la columna 'Rem. Sujeta a Aportes' es informativa y no tiene techo."
    );
  }
  // La alerta que vivía acá ("JUBILACION/CONTRIB_JUBILACION no aplican
  // tope") quedó OBSOLETA — se resolvió cuando se conectó liquidar/route.ts
  // con los ParametroVigente reales (antes se armaba el contexto de topes
  // pero nunca se lo pasaba al motor). El importe que ves en este export
  // ya viene topeado correctamente desde el recibo, no hace falta advertir
  // nada acá.
  const nota = notas.length > 0 ? `\r\n\r\n(*) ${notas.join(" | ")}` : "";

  return new NextResponse(csv + nota, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="F931_consolidado_${periodo.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.csv"`,
    },
  });
}
