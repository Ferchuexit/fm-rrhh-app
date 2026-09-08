// FM RRHH — prisma/cargar-convenio-camioneros.ts
//
// Primer convenio nuevo agregado al sistema (además de Madera/Comercio) —
// pensado para una empresa de transporte de carga general, NO para ramas
// especializadas del CCT 40/89 (petrolero, residuos, clearing/correo,
// caudales blindados, grúas por tonelaje, mudanzas, logística, etc.). Esas
// ramas tienen sus propios adicionales porcentuales (ver Cartilla
// Ampliatoria que compartió Fernando) que NO se cargan acá — si el día de
// mañana hace falta alguna, se agrega como una fila nueva de ReglaConcepto
// para este mismo convenio, sin tocar nada de lo que ya existe.
//
// Categorías EXCLUIDAS a propósito (rama específica, no "carga común"):
// grúas por tonelaje, embaladores/mudanza, recolectores de residuos,
// peones de barrido y limpieza, todo el bloque Clearing/Carga Postal,
// todo el bloque Transporte de Caudales.
//
// Fuente: escala salarial vigente 1/8/2026 (planilla 245, imagen provista
// por Fernando) + Cartilla Ampliatoria (para las categorías de Conductor).
//
// PENDIENTE, a propósito, no inventado:
//   - Cuota SINDICAL de OSCHOCA — esa sí varía por gremio, no la tengo confirmada.
//   - Horas extra: en este convenio son un valor $ FIJO por categoría (no
//     un % de un valor hora), ya viene en la planilla — se puede cargar
//     con ValorConceptoCategoria + VALOR_CATEGORIA(), pero es un paso
//     aparte.
//   - Antigüedad: la CCT dice "1% por año sobre la TOTALIDAD de los rubros
//     remunerativos" — hoy eso equivale a solo REM_BASICA porque no se
//     cargó ningún otro adicional remunerativo para este perfil general.
//     Si más adelante se agrega otro concepto remunerativo a Camioneros,
//     HAY QUE SUMARLO A MANO en la fórmula de ANTIGUEDAD de abajo (no se
//     puede usar REM_TOTAL() acá — el motor lo prohíbe en conceptos
//     remunerativos, solo se puede usar en descuentos/contribuciones).
//   - Vacaciones (adicional fijo $25.132,45/día), Día del Trabajador
//     Camionero (15/12), Adicional Bitrenes — no cargados todavía.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VIGENCIA_ESCALA = new Date("2026-08-01");
const CODIGO_CONVENIO = "40/89";
const NOMBRE_CONVENIO = "Camioneros (CCT 40/89)";

// [código corto, nombre completo, básico mensual agosto 2026]
const CATEGORIAS: [string, string, number][] = [
  ["COND1", "Conductor de Primera Categoría", 1075910.44],
  ["COND2", "Conductor de Segunda Categoría", 1056737.31],
  ["COND3", "Conductor de Tercera Categoría", 1037544.76],
  ["ENCARGADO", "Encargado", 1011203.97],
  ["RECIBIDOR", "Recibidor y/o Clasificador de guías", 1001558.62],
  ["PEON", "Peón", 982641.94],
  ["AYUDANTE", "Ayudante mayor de 18 años", 963809.78],
  ["OF1TALLER", "Oficial de Primera (Taller)", 1198273.54],
  ["OFCOMPLETO", "Oficial completo de taller", 1136190.18],
  ["OFICIAL", "Oficial (Taller)", 1080223.62],
  ["MEDIOOF", "Medio Oficial (Taller)", 1020444.59],
  ["MEDIOGOMERO", "Medio Gomero", 1080223.62],
  ["MEDIOOFGOMERO", "Medio Oficial Gomero", 1020444.59],
  ["LAVADOR", "Lavador/Engrasador/Ayudante de Taller", 1020444.59],
  ["ADMIN1", "Administrativo de Primera Categoría", 1070673.40],
  ["ADMIN2", "Administrativo de Segunda Categoría", 1029898.82],
  ["ADMIN3", "Administrativo de Tercera Categoría", 992110.50],
  ["ADMIN4", "Administrativo de Cuarta Categoría", 973234.84],
  ["MAESTRANZA", "Maestranza y/o sereno", 973234.84],
];

// La CCT dice "sobre la totalidad de los rubros remunerativos" — ver nota
// grande arriba sobre por qué acá es solo REM_BASICA por ahora.
const BASE_ANTIGUEDAD = "CONCEPTO('REM_BASICA')";

async function main() {
  const convenio = await prisma.convenio.upsert({
    where: { codigo: CODIGO_CONVENIO },
    update: {},
    create: { codigo: CODIGO_CONVENIO, nombre: NOMBRE_CONVENIO },
  });
  console.log(`✔ Convenio: ${convenio.nombre} (${convenio.codigo})`);

  for (const [codigo, nombre, basico] of CATEGORIAS) {
    let categoria = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, codigo } });
    if (!categoria) {
      categoria = await prisma.categoria.create({ data: { convenioId: convenio.id, codigo, nombre } });
    }

    const yaExisteEscala = await prisma.escala.findFirst({ where: { categoriaId: categoria.id, vigenciaDesde: VIGENCIA_ESCALA } });
    if (!yaExisteEscala) {
      await prisma.escala.create({
        data: { convenioId: convenio.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_ESCALA, basico, valorHora: 0 },
      });
    }
    console.log(`  ✔ ${nombre}: básico $${basico.toLocaleString("es-AR")}`);
  }

  // ── REM_BASICA, ANTIGUEDAD, y aportes/contribuciones NACIONALES para Camioneros ──
  // Jubilación (11%), Ley 19.032 (3%) y Obra Social (3%) son tasas fijadas
  // por ley nacional — iguales en cualquier convenio, lo único que cambia
  // por gremio es a qué obra social/sindicato va cada aporte, no el %. Lo
  // mismo del lado patronal (18%/6%). Se usa el mismo TOPE_JUBILATORIO real
  // que ya está cargado para Madera/Comercio (es una regla nacional, no de
  // convenio) — ver prisma/cargar-topes-reales-y-aplicar.ts.
  //
  // Cuota SINDICAL queda afuera a propósito: esa sí la fija cada gremio por
  // separado (OSCHOCA en este caso) y no está confirmada todavía.
  const conceptoBasico = await prisma.concepto.findUnique({ where: { codigo: "REM_BASICA" } });
  const conceptoAntiguedad = await prisma.concepto.findUnique({ where: { codigo: "ANTIGUEDAD" } });
  const conceptoJubilacion = await prisma.concepto.findUnique({ where: { codigo: "JUBILACION" } });
  const conceptoLey19032 = await prisma.concepto.findUnique({ where: { codigo: "LEY_19032" } });
  const conceptoObraSocial = await prisma.concepto.findUnique({ where: { codigo: "OBRA_SOCIAL" } });
  const conceptoContribJubilacion = await prisma.concepto.findUnique({ where: { codigo: "CONTRIB_JUBILACION" } });
  const conceptoContribObraSocial = await prisma.concepto.findUnique({ where: { codigo: "CONTRIB_OBRA_SOCIAL" } });

  const faltantes = [
    ["REM_BASICA", conceptoBasico], ["ANTIGUEDAD", conceptoAntiguedad], ["JUBILACION", conceptoJubilacion],
    ["LEY_19032", conceptoLey19032], ["OBRA_SOCIAL", conceptoObraSocial],
    ["CONTRIB_JUBILACION", conceptoContribJubilacion], ["CONTRIB_OBRA_SOCIAL", conceptoContribObraSocial],
  ].filter(([, c]) => !c).map(([codigo]) => codigo);
  if (faltantes.length > 0) {
    console.log(`⚠ No se encontraron estos conceptos en el catálogo: ${faltantes.join(", ")} — revisar antes de liquidar.`);
    return;
  }

  const conTechoYPiso = (expr: string) =>
    `IF(DIAS_TRABAJADOS >= DIAS_MES, MAX(MIN(${expr}, TOPE('TOPE_JUBILATORIO')), TOPE('TOPE_JUBILATORIO_MINIMO')), MIN(${expr}, TOPE('TOPE_JUBILATORIO')))`;

  const reglas: { concepto: typeof conceptoBasico; formula: string; aporta: boolean; contribuye: boolean }[] = [
    { concepto: conceptoBasico!, formula: "BASICO", aporta: true, contribuye: true },
    { concepto: conceptoAntiguedad!, formula: `${BASE_ANTIGUEDAD} * ANTIGUEDAD_ANIOS * 0.01`, aporta: true, contribuye: true },
    { concepto: conceptoJubilacion!, formula: `${conTechoYPiso("REM_TOTAL()")} * 0.11`, aporta: false, contribuye: false },
    { concepto: conceptoLey19032!, formula: `${conTechoYPiso("REM_TOTAL()")} * 0.03`, aporta: false, contribuye: false },
    { concepto: conceptoObraSocial!, formula: `${conTechoYPiso("REM_TOTAL()")} * 0.03`, aporta: false, contribuye: false },
    { concepto: conceptoContribJubilacion!, formula: "REM_TOTAL() * 0.18", aporta: false, contribuye: false },
    { concepto: conceptoContribObraSocial!, formula: "REM_TOTAL() * 0.06", aporta: false, contribuye: false },
  ];

  for (const r of reglas) {
    const yaExiste = await prisma.reglaConcepto.findFirst({
      where: { conceptoId: r.concepto.id, convenioId: convenio.id, vigenciaHasta: null },
    });
    if (yaExiste) {
      console.log(`  "${r.concepto.codigo}" ya tenía una regla vigente para este convenio — no se tocó.`);
      continue;
    }
    await prisma.reglaConcepto.create({
      data: {
        conceptoId: r.concepto.id, convenioId: convenio.id,
        vigenciaDesde: VIGENCIA_ESCALA, formula: r.formula, aporta: r.aporta, contribuye: r.contribuye,
      },
    });
    console.log(`  ✔ Regla "${r.concepto.codigo}": ${r.formula}`);
  }

  // ── Horas extra: valor FIJO en pesos por hora, por categoría (no un %
  // del valor hora como en Madera/Comercio) — se carga con
  // ValorConceptoCategoria + VALOR_CATEGORIA(), el mecanismo que el
  // proyecto ya tenía pensado justo para este caso.
  //
  // OJO — descubrimiento al pasar: HS_EXTRA_50/HS_EXTRA_100 existen en el
  // catálogo (Concepto) desde el principio del proyecto, pero NUNCA
  // tuvieron una ReglaConcepto real para NINGÚN convenio — ni Madera ni
  // Comercio las liquidan hoy. No se toca eso acá (es una tarea aparte,
  // fuera del alcance de "agregar Camioneros"), solo se deja constancia.
  const conceptoHs50 = await prisma.concepto.findUnique({ where: { codigo: "HS_EXTRA_50" } });
  const conceptoHs100 = await prisma.concepto.findUnique({ where: { codigo: "HS_EXTRA_100" } });
  if (!conceptoHs50 || !conceptoHs100) {
    console.log("⚠ No se encontraron HS_EXTRA_50/HS_EXTRA_100 en el catálogo.");
    return;
  }

  // [código de categoría, valor hora 50%, valor hora 100%] — planilla 245, agosto 2026
  const VALORES_HS_EXTRA: [string, number, number][] = [
    ["COND1", 8405.55, 11207.40],
    ["COND2", 8255.76, 11007.68],
    ["COND3", 8105.82, 10807.76],
    ["ENCARGADO", 7900.03, 10533.38],
    ["RECIBIDOR", 7824.68, 10432.90],
    ["PEON", 7676.89, 10235.85],
    ["AYUDANTE", 7529.76, 10039.69],
    ["OF1TALLER", 9361.51, 12482.02],
    ["OFCOMPLETO", 8876.49, 11835.32],
    ["OFICIAL", 8439.25, 11252.33],
    ["MEDIOOF", 7972.22, 10629.63],
    ["MEDIOGOMERO", 8439.25, 11252.33],
    ["MEDIOOFGOMERO", 7972.22, 10629.63],
    ["LAVADOR", 7972.22, 10629.63],
    ["ADMIN1", 8364.64, 11152.85],
    ["ADMIN2", 8046.08, 10728.11],
    ["ADMIN3", 7750.86, 10334.49],
    ["ADMIN4", 7603.40, 10137.86],
    ["MAESTRANZA", 7603.40, 10137.86],
  ];

  for (const [codigoCategoria, valor50, valor100] of VALORES_HS_EXTRA) {
    const categoria = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, codigo: codigoCategoria } });
    if (!categoria) { console.log(`⚠ No se encontró la categoría "${codigoCategoria}" — se salta.`); continue; }

    for (const [concepto, valor] of [[conceptoHs50, valor50], [conceptoHs100, valor100]] as const) {
      const yaExiste = await prisma.valorConceptoCategoria.findFirst({
        where: { conceptoId: concepto.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_ESCALA },
      });
      if (!yaExiste) {
        await prisma.valorConceptoCategoria.create({
          data: { conceptoId: concepto.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_ESCALA, valor },
        });
      }
    }
    console.log(`  ✔ ${codigoCategoria}: hs. extra 50% $${valor50} — 100% $${valor100}`);
  }

  // Reglas de HS_EXTRA_50/100 para Camioneros — CANTIDAD() toma la
  // cantidad de horas cargada en la Novedad correspondiente.
  const reglasHsExtra = [
    { concepto: conceptoHs50, formula: "VALOR_CATEGORIA('HS_EXTRA_50') * CANTIDAD()" },
    { concepto: conceptoHs100, formula: "VALOR_CATEGORIA('HS_EXTRA_100') * CANTIDAD()" },
  ];
  for (const r of reglasHsExtra) {
    const yaExisteRegla = await prisma.reglaConcepto.findFirst({
      where: { conceptoId: r.concepto.id, convenioId: convenio.id, vigenciaHasta: null },
    });
    if (yaExisteRegla) {
      console.log(`  "${r.concepto.codigo}" ya tenía una regla vigente para este convenio — no se tocó.`);
      continue;
    }
    await prisma.reglaConcepto.create({
      data: { conceptoId: r.concepto.id, convenioId: convenio.id, vigenciaDesde: VIGENCIA_ESCALA, formula: r.formula, aporta: true, contribuye: true },
    });
    console.log(`  ✔ Regla "${r.concepto.codigo}": ${r.formula}`);
  }

  // ── Vacaciones: adicional fijo por día gozado (Item 3.3.2) ──
  // $25.132,45 por cada día de vacaciones — un monto ÚNICO, igual para
  // todas las categorías (a diferencia de las horas extra), así que se
  // carga como ParametroVigente (mismo mecanismo que TOPE_JUBILATORIO:
  // un valor versionado por fecha, no por categoría) y se lee con TOPE()
  // — el nombre de la función es histórico, pero en el fondo solo lee
  // "el parámetro vigente en esta fecha", sirve para cualquier valor así.
  const yaExisteParamVacaciones = await prisma.parametroVigente.findFirst({
    where: { clave: "ADICIONAL_VACACIONES_CAMIONEROS", vigenciaDesde: VIGENCIA_ESCALA },
  });
  if (!yaExisteParamVacaciones) {
    await prisma.parametroVigente.create({
      data: {
        clave: "ADICIONAL_VACACIONES_CAMIONEROS", valor: 25132.45,
        vigenciaDesde: VIGENCIA_ESCALA, fuente: "CCT 40/89, Item 3.3.2 — planilla 245, vigente desde 1/8/2026",
      },
    });
  }
  console.log("  ✔ Parámetro ADICIONAL_VACACIONES_CAMIONEROS: $25.132,45/día");

  let conceptoAdicVacaciones = await prisma.concepto.findUnique({ where: { codigo: "ADICIONAL_VACACIONES" } });
  if (!conceptoAdicVacaciones) {
    conceptoAdicVacaciones = await prisma.concepto.create({
      data: { codigo: "ADICIONAL_VACACIONES", nombre: "Adicional fijo por día de vacaciones", tipo: "remunerativo", unidad: "dias", categoriaNovedad: "Licencias y Ausencias" },
    });
    console.log("  ✔ Concepto nuevo: ADICIONAL_VACACIONES (compartido, cualquier convenio puede usarlo)");
  }

  const yaExisteReglaVacaciones = await prisma.reglaConcepto.findFirst({
    where: { conceptoId: conceptoAdicVacaciones.id, convenioId: convenio.id, vigenciaHasta: null },
  });
  if (!yaExisteReglaVacaciones) {
    await prisma.reglaConcepto.create({
      data: {
        conceptoId: conceptoAdicVacaciones.id, convenioId: convenio.id, vigenciaDesde: VIGENCIA_ESCALA,
        formula: "CANTIDAD() * TOPE('ADICIONAL_VACACIONES_CAMIONEROS')", aporta: true, contribuye: true,
      },
    });
    console.log("  ✔ Regla \"ADICIONAL_VACACIONES\": CANTIDAD() * TOPE('ADICIONAL_VACACIONES_CAMIONEROS')");
  }

  // ── Día del Trabajador Camionero (15/12, Item 3.3.3) ──
  // Se paga el jornal diario de la categoría con 100% de recargo (o sea,
  // el doble) si se trabaja ese día en un día de semana normal, o 200% de
  // recargo (el triple) si el 15/12 cae sábado o domingo. El motor NO
  // sabe qué día de la semana cae el 15/12 de un año dado (no tiene
  // noción de calendario) — así que el multiplicador (2 ó 3) lo elegís
  // vos a mano cada diciembre al cargar la novedad, según corresponda ese
  // año. CANTIDAD() acá representa ESE multiplicador, no "cantidad de
  // días" — quedó documentado en el nombre del concepto para que no se
  // preste a confusión.
  let conceptoDiaCamionero = await prisma.concepto.findUnique({ where: { codigo: "DIA_CAMIONERO" } });
  if (!conceptoDiaCamionero) {
    conceptoDiaCamionero = await prisma.concepto.create({
      data: {
        codigo: "DIA_CAMIONERO", nombre: "Día del Trabajador Camionero (15/12) — cargar 2 si se trabajó en día de semana, 3 si cayó sábado/domingo",
        tipo: "remunerativo", unidad: "monto", categoriaNovedad: "Premios y Comisiones",
      },
    });
    console.log("  ✔ Concepto nuevo: DIA_CAMIONERO");
  }

  const VALORES_JORNAL_DIARIO: [string, number][] = [
    ["COND1", 44829.60], ["COND2", 44030.72], ["COND3", 43231.03], ["ENCARGADO", 42133.50],
    ["RECIBIDOR", 41731.61], ["PEON", 40943.41], ["AYUDANTE", 40158.74], ["OF1TALLER", 49928.06],
    ["OFCOMPLETO", 47341.26], ["OFICIAL", 45009.32], ["MEDIOOF", 42518.52], ["MEDIOGOMERO", 45009.32],
    ["MEDIOOFGOMERO", 42518.52], ["LAVADOR", 42518.52], ["ADMIN1", 44611.39], ["ADMIN2", 42912.45],
    ["ADMIN3", 41337.96], ["ADMIN4", 40551.45], ["MAESTRANZA", 40551.45],
  ];
  for (const [codigoCategoria, jornal] of VALORES_JORNAL_DIARIO) {
    const categoria = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, codigo: codigoCategoria } });
    if (!categoria) continue;
    const yaExisteValor = await prisma.valorConceptoCategoria.findFirst({
      where: { conceptoId: conceptoDiaCamionero.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_ESCALA },
    });
    if (!yaExisteValor) {
      await prisma.valorConceptoCategoria.create({
        data: { conceptoId: conceptoDiaCamionero.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_ESCALA, valor: jornal },
      });
    }
  }
  console.log("  ✔ Jornal diario por categoría cargado para DIA_CAMIONERO");

  const yaExisteReglaDiaCamionero = await prisma.reglaConcepto.findFirst({
    where: { conceptoId: conceptoDiaCamionero.id, convenioId: convenio.id, vigenciaHasta: null },
  });
  if (!yaExisteReglaDiaCamionero) {
    await prisma.reglaConcepto.create({
      data: {
        conceptoId: conceptoDiaCamionero.id, convenioId: convenio.id, vigenciaDesde: VIGENCIA_ESCALA,
        formula: "VALOR_CATEGORIA('DIA_CAMIONERO') * CANTIDAD()", aporta: true, contribuye: true,
      },
    });
    console.log("  ✔ Regla \"DIA_CAMIONERO\": VALOR_CATEGORIA('DIA_CAMIONERO') * CANTIDAD()  — cargar CANTIDAD=2 (día de semana) o 3 (cae sábado/domingo)");
  }

  // ── Cuota sindical OSCHOCA: 3% afiliados / 2,5% no afiliados ──
  // Usa el campo Legajo.afiliadoSindicato (nuevo) a través de la variable
  // AFILIADO_SINDICATO que liquidar/route.ts ya arma para todo legajo,
  // sin importar el convenio.
  const conceptoSindicato = await prisma.concepto.findUnique({ where: { codigo: "SINDICATO" } });
  if (!conceptoSindicato) {
    console.log("⚠ No se encontró el concepto SINDICATO en el catálogo.");
  } else {
    const yaExisteReglaSindicato = await prisma.reglaConcepto.findFirst({
      where: { conceptoId: conceptoSindicato.id, convenioId: convenio.id, vigenciaHasta: null },
    });
    if (!yaExisteReglaSindicato) {
      await prisma.reglaConcepto.create({
        data: {
          conceptoId: conceptoSindicato.id, convenioId: convenio.id, vigenciaDesde: VIGENCIA_ESCALA,
          formula: "IF(AFILIADO_SINDICATO == 1, REM_TOTAL() * 0.03, REM_TOTAL() * 0.025)",
          aporta: false, contribuye: false,
        },
      });
      console.log("  ✔ Regla \"SINDICATO\": 3% afiliados / 2,5% no afiliados (OSCHOCA)");
    } else {
      console.log("  \"SINDICATO\" ya tenía una regla vigente para este convenio — no se tocó.");
    }
  }

  console.log("\nListo. Pendiente (a propósito, no inventado): ninguno de los ítems generales — solo quedan las ramas especializadas fuera de alcance.");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
