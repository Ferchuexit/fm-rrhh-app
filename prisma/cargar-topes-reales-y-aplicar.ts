// FM RRHH — prisma/cargar-topes-reales-y-aplicar.ts
//
// Resuelve 2 cosas encontradas al revisar F.931 (ver notas del export):
//
//   1. El TOPE_JUBILATORIO cargado en /parametros era un valor de
//      referencia inventado ($1.200.000, "confirmar contra la resolución
//      vigente real" decía la nota del seed). Acá se reemplaza por la
//      serie REAL de ANSES, mes a mes, desde marzo 2026 hasta agosto 2026
//      (las resoluciones que pude confirmar contra el Boletín Oficial):
//
//        Marzo   2026 (Res. 38/2026):  mínima $124.481,49 / máxima $4.045.590,45
//        Abril   2026 (Res. 74/2026):  mínima $128.091,45 / máxima $4.162.912,57
//        Mayo    2026 (Res. 110/2026): mínima $132.420,94 / máxima $4.303.619,01
//        Junio   2026 (Res. 139/2026): mínima $135.837,40 / máxima $4.414.652,38
//        Julio   2026 (Res. 186/2026): mínima $138.757,90 / máxima $4.509.567,41
//        Agosto  2026 (Res. 232/2026): mínima $141.380,42 / máxima $4.594.798,23
//
//      Períodos ANTERIORES a marzo 2026 (si algún día hace falta reliquidar
//      algo retroactivo) van a seguir resolviendo al placeholder viejo — no
//      tengo la resolución confirmada para esos meses. Avisar si hace falta.
//
//   2. Ninguna fórmula de JUBILACION/LEY_19032/OBRA_SOCIAL aplicaba el tope
//      — se calculaban sobre la base completa sin techo. Se corrige acá.
//
//      IMPORTANTE — lo que NO se toca, a propósito: CONTRIB_JUBILACION y
//      CONTRIB_OBRA_SOCIAL (las contribuciones PATRONALES) NO llevan tope
//      desde el Decreto 814/2001 — confirmado: "Contribuciones (Sin Límite
//      Máximo)". El tope de ANSES solo aplica a los APORTES del empleado
//      (Jubilación, Ley 19.032, Obra Social) — por eso son las únicas 3
//      fórmulas que se tocan acá.
//
//   El tope MÍNIMO ($141.380,42 en agosto) también se aplica ahora, con una
//   condición: SOLO si se trabajó el mes completo (DIAS_TRABAJADOS >=
//   DIAS_MES). Si alguien ingresó, egresó, o tuvo licencia sin goce de
//   haberes a mitad de período, su sueldo prorrateado por debajo del piso
//   NO se fuerza — eso necesitaría prorratear el piso mismo, y esa regla
//   puntual no está confirmada contra Tango todavía (ver "Qué falta").
//
// No destructivo: cierra vigencias, no las borra. Las liquidaciones YA
// CERRADAS no se recalculan — la fórmula nueva rige desde HOY para
// adelante, exactamente el mismo criterio que ya usa el resto del proyecto
// (Escala, ValorConceptoCategoria, etc.).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HOY = new Date();

// ────────────────────────────────────────────────────────────
// 1. Topes reales — serie histórica confirmada
// ────────────────────────────────────────────────────────────
const TOPES_MAXIMOS: { desde: string; hasta: string | null; valor: number; fuente: string }[] = [
  { desde: "2026-03-01", hasta: "2026-03-31", valor: 4045590.45, fuente: "ANSES Res. 38/2026 (B.O.)" },
  { desde: "2026-04-01", hasta: "2026-04-30", valor: 4162912.57, fuente: "ANSES Res. 74/2026 (B.O.)" },
  { desde: "2026-05-01", hasta: "2026-05-31", valor: 4303619.01, fuente: "ANSES Res. 110/2026" },
  { desde: "2026-06-01", hasta: "2026-06-30", valor: 4414652.38, fuente: "ANSES Res. 139/2026 (B.O.)" },
  { desde: "2026-07-01", hasta: "2026-07-31", valor: 4509567.41, fuente: "ANSES Res. 186/2026" },
  { desde: "2026-08-01", hasta: null, valor: 4594798.23, fuente: "ANSES Res. 232/2026 (B.O. 30/07/2026)" },
];

const TOPES_MINIMOS: { desde: string; hasta: string | null; valor: number; fuente: string }[] = [
  { desde: "2026-03-01", hasta: "2026-03-31", valor: 124481.49, fuente: "ANSES Res. 38/2026 (B.O.)" },
  { desde: "2026-04-01", hasta: "2026-04-30", valor: 128091.45, fuente: "ANSES Res. 74/2026 (B.O.)" },
  { desde: "2026-05-01", hasta: "2026-05-31", valor: 132420.94, fuente: "ANSES Res. 110/2026" },
  { desde: "2026-06-01", hasta: "2026-06-30", valor: 135837.40, fuente: "ANSES Res. 139/2026 (B.O.)" },
  { desde: "2026-07-01", hasta: "2026-07-31", valor: 138757.90, fuente: "ANSES Res. 186/2026" },
  { desde: "2026-08-01", hasta: null, valor: 141380.42, fuente: "ANSES Res. 232/2026 (B.O. 30/07/2026)" },
];

async function cargarSerieTopes(clave: string, serie: typeof TOPES_MAXIMOS) {
  // Cierra el placeholder viejo (si existe) justo antes del primer valor real.
  const placeholder = await prisma.parametroVigente.findFirst({ where: { clave, vigenciaHasta: null } });
  if (placeholder) {
    await prisma.parametroVigente.update({
      where: { id: placeholder.id },
      data: { vigenciaHasta: new Date("2026-02-28") },
    });
    console.log(`  Placeholder anterior de "${clave}" cerrado (quedó vigente hasta 28/02/2026, para períodos viejos).`);
  }

  for (const t of serie) {
    const yaExiste = await prisma.parametroVigente.findFirst({
      where: { clave, vigenciaDesde: new Date(t.desde) },
    });
    if (yaExiste) { console.log(`  Ya estaba cargado: ${clave} ${t.desde} — sin cambios.`); continue; }

    await prisma.parametroVigente.create({
      data: {
        clave,
        valor: t.valor,
        vigenciaDesde: new Date(t.desde),
        vigenciaHasta: t.hasta ? new Date(t.hasta) : null,
        fuente: t.fuente,
      },
    });
    console.log(`  ✔ ${clave} desde ${t.desde}: $${t.valor.toLocaleString("es-AR")} (${t.fuente})`);
  }
}

// ────────────────────────────────────────────────────────────
// 2. Fórmulas corregidas — mismo criterio de base que ya tenían,
//    ahora con TECHO (tope máximo) y PISO (tope mínimo).
//
//    El piso SOLO se fuerza si se trabajó el mes completo
//    (DIAS_TRABAJADOS >= DIAS_MES). Si el mes es parcial —alguien que
//    ingresó, egresó, o tuvo licencia sin goce de haberes a mitad de
//    período— NO se fuerza al piso: eso requeriría prorratear el piso
//    mismo por los días trabajados, y esa regla de prorrateo específica
//    no está confirmada todavía (ver "Qué falta" al final). Confirmado
//    con un smoke test: mes completo por debajo del piso → se sube al
//    piso; mes parcial por debajo del piso → se deja como está.
// ────────────────────────────────────────────────────────────
const BASE_REM_COMERCIO = "(CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD') + CONCEPTO('PRESENTISMO'))";

function conTechoYPiso(baseExpr: string): string {
  return `IF(DIAS_TRABAJADOS >= DIAS_MES, MAX(MIN(${baseExpr}, TOPE('TOPE_JUBILATORIO')), TOPE('TOPE_JUBILATORIO_MINIMO')), MIN(${baseExpr}, TOPE('TOPE_JUBILATORIO')))`;
}

const FORMULAS_NUEVAS: { convenioCodigo: string; concepto: string; formula: string; nota: string }[] = [
  {
    convenioCodigo: "0335/75", // Madera
    concepto: "JUBILACION",
    formula: `${conTechoYPiso("REM_TOTAL()")} * 0.11`,
    nota: "misma base que antes (REM_TOTAL), ahora con techo y piso",
  },
  {
    convenioCodigo: "0335/75",
    concepto: "LEY_19032",
    formula: `${conTechoYPiso("REM_TOTAL()")} * 0.03`,
    nota: "misma base que antes (REM_TOTAL), ahora con techo y piso",
  },
  {
    convenioCodigo: "0335/75",
    concepto: "OBRA_SOCIAL",
    formula: `${conTechoYPiso("REM_TOTAL() + NOREM_TOTAL()")} * 0.03`,
    nota: "misma base que antes (REM_TOTAL+NOREM_TOTAL), ahora con techo y piso",
  },
  {
    convenioCodigo: "0130/75", // Comercio
    concepto: "JUBILACION",
    formula: `${conTechoYPiso(BASE_REM_COMERCIO)} * 0.11`,
    nota: "misma base que antes (Básico+Antigüedad+Presentismo), ahora con techo y piso",
  },
  {
    convenioCodigo: "0130/75",
    concepto: "LEY_19032",
    formula: `${conTechoYPiso(BASE_REM_COMERCIO)} * 0.03`,
    nota: "misma base que antes, ahora con techo y piso",
  },
  {
    convenioCodigo: "0130/75",
    concepto: "OBRA_SOCIAL",
    formula: `${conTechoYPiso(BASE_REM_COMERCIO)} * 0.03`,
    nota: "misma base que antes, ahora con techo y piso",
  },
];

async function aplicarFormulaNueva(f: (typeof FORMULAS_NUEVAS)[number]) {
  const convenio = await prisma.convenio.findUnique({ where: { codigo: f.convenioCodigo } });
  if (!convenio) { console.log(`  ⚠ No existe el convenio "${f.convenioCodigo}" — se salta.`); return; }

  const concepto = await prisma.concepto.findUnique({ where: { codigo: f.concepto } });
  if (!concepto) { console.log(`  ⚠ No existe el concepto "${f.concepto}" — se salta.`); return; }

  const vigente = await prisma.reglaConcepto.findFirst({
    where: { conceptoId: concepto.id, convenioId: convenio.id, vigenciaHasta: null },
  });

  if (vigente?.formula === f.formula) {
    console.log(`  "${f.concepto}" (${f.convenioCodigo}) ya tiene la fórmula topeada — sin cambios.`);
    return;
  }

  const ayer = new Date(HOY);
  ayer.setDate(ayer.getDate() - 1);

  await prisma.$transaction(async (tx) => {
    if (vigente) {
      await tx.reglaConcepto.update({ where: { id: vigente.id }, data: { vigenciaHasta: ayer } });
    }
    await tx.reglaConcepto.create({
      data: {
        conceptoId: concepto.id,
        convenioId: convenio.id,
        vigenciaDesde: HOY,
        formula: f.formula,
        aporta: vigente?.aporta ?? false,
        contribuye: vigente?.contribuye ?? false,
      },
    });
  });

  console.log(`  ✔ "${f.concepto}" (${f.convenioCodigo}): fórmula anterior cerrada, nueva vigente desde hoy — ${f.nota}.`);
  console.log(`     Antes: ${vigente?.formula ?? "(sin regla previa)"}`);
  console.log(`     Ahora: ${f.formula}`);
}

async function main() {
  console.log("=== 1. Cargando serie real de TOPE_JUBILATORIO (máximo, aplicado) ===");
  await cargarSerieTopes("TOPE_JUBILATORIO", TOPES_MAXIMOS);

  console.log("\n=== 2. Cargando serie real de TOPE_JUBILATORIO_MINIMO (piso, aplicado con condición) ===");
  await cargarSerieTopes("TOPE_JUBILATORIO_MINIMO", TOPES_MINIMOS);

  console.log("\n=== 3. Aplicando techo Y piso a las fórmulas de aportes del empleado (Jubilación, Ley 19.032, Obra Social) ===");
  console.log("     (Las contribuciones PATRONALES no se tocan — no tienen tope desde el Decreto 814/2001.)");
  console.log("     (El piso solo se fuerza si DIAS_TRABAJADOS >= DIAS_MES — mes parcial no se prorratea todavía.)");
  for (const f of FORMULAS_NUEVAS) {
    await aplicarFormulaNueva(f);
  }

  console.log("\nListo. Las liquidaciones ya cerradas NO se recalculan — la fórmula nueva rige desde hoy.");
  console.log("Para confirmar: liquidá cualquier legajo de prueba y probá la fórmula en /reglas antes y después.");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
