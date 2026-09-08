// FM RRHH — prisma/mapear-codigos-arca.ts
// Mapea cada concepto a su código OFICIAL de ARCA (para el LSD) — ver
// 72-lsd-codigos-arca.md para el detalle completo de cada uno y las
// fuentes consultadas.
//
// ⚠️ IMPORTANTE: los marcados "PROVISORIO" son mi mejor estimación con la
// información pública que pude encontrar — NO están confirmados contra tu
// Tango real ni contra la pantalla de parametrización de ARCA. No los di
// por buenos solo porque son plausibles — necesitan tu confirmación antes
// de usarse en una presentación real.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAPEO: Record<string, { codigo: string; confirmado: boolean; fuente: string }> = {
  // ── Confirmados contra LSDetalleConceptos (documento oficial ARCA) ──
  REM_BASICA: { codigo: "110000", confirmado: true, fuente: "Sueldo" },
  FERIADOS: { codigo: "110007", confirmado: true, fuente: "Feriado" },
  ANTIGUEDAD: { codigo: "160001", confirmado: true, fuente: "Adicional por antigüedad" },
  PRESENTISMO: { codigo: "170001", confirmado: true, fuente: "Premio por presentismo" },
  JUBILACION: { codigo: "810000", confirmado: true, fuente: "Sistema previsional" },
  LEY_19032: { codigo: "810001", confirmado: true, fuente: "INSSJyP" },
  OBRA_SOCIAL: { codigo: "810002", confirmado: true, fuente: "Obra Social" },
  SINDICATO: { codigo: "810004", confirmado: true, fuente: "Cuota Sindical" },
  SEGURO_SEPELIO: { codigo: "810005", confirmado: true, fuente: "Seguro de Vida (el más cercano — confirmá si ARCA distingue Sepelio de Vida)" },
  RETENCION_GANANCIAS: { codigo: "810008", confirmado: true, fuente: "Impuesto a las Ganancias — LSDetalleConceptos.pdf (documento oficial ARCA/AFIP), sección Descuentos." },
  SEGURO_MERCANTIL: { codigo: "810005", confirmado: false, fuente: "PROVISORIO: mismo código que Seguro Sepelio (810005, Seguro de Vida) por ser semánticamente parecido — no confirmado. Vos ya me diste el código real de Enfermedad (16), si tenés este también decímelo." },
  REDONDEO: { codigo: "799999", confirmado: true, fuente: "Redondeo (No Remunerativo) — código dedicado, coincide exacto con nuestro tipo" },

  // ── Provisorios — necesitan tu confirmación ──
  HS_ENFERMEDAD: { codigo: "16", confirmado: true, fuente: "CONFIRMADO por Fernando, contra las liquidaciones reales de Moras — Licencia por enfermedad." },
  HS_ART: { codigo: "110008", confirmado: false, fuente: "PROVISORIO: 'Prestación Dineraria Ley 24.557 (primeros 10 días)' — hay también un 110009 'a cargo de ART' si corresponde a otro tramo." },
  VACACIONES_HORAS: { codigo: "110000", confirmado: false, fuente: "PROVISORIO: no encontré un código específico para vacaciones PAGADAS dentro del período (150000 es 'Adelanto vacacional', que es otra cosa)." },
  SNR: { codigo: "540000", confirmado: false, fuente: "PROVISORIO: 'Incrementos no remunerativos (con aportes y contribuciones OS)' — coincide con cómo armamos la base, pero no confirmado 1 a 1." },
  AJUSTE_SAC: { codigo: "540000", confirmado: false, fuente: "PROVISORIO: mismo código que S.N.R. — puede que ARCA quiera un subcódigo propio del rango 541000-549999 para distinguirlo." },
  RECOMPOSICION_ABR26: { codigo: "540000", confirmado: false, fuente: "PROVISORIO: mismo criterio que S.N.R." },
  SUMA_FIJA_ABR26: { codigo: "540000", confirmado: false, fuente: "PROVISORIO" },
  SUMA_UNICA_REV26: { codigo: "540000", confirmado: false, fuente: "PROVISORIO" },
  ANTIG_RECOMP_ABR26: { codigo: "540000", confirmado: false, fuente: "PROVISORIO" },
  ANTIG_SUMAFIJA_ABR26: { codigo: "540000", confirmado: false, fuente: "PROVISORIO" },
  PRESENTISMO_RECOMP_ABR26: { codigo: "540000", confirmado: false, fuente: "PROVISORIO" },
  PRESENTISMO_SUMAFIJA_ABR26: { codigo: "540000", confirmado: false, fuente: "PROVISORIO" },
  INCREMENTO_NR: { codigo: "540000", confirmado: false, fuente: "PROVISORIO — este concepto ya no se usa en Madera (reemplazado por SNR/AJUSTE_SAC), pero sigue activo en Comercio." },
};

async function main() {
  let confirmados = 0;
  let provisorios = 0;
  const sinMapeo: string[] = [];

  for (const [codigoConcepto, info] of Object.entries(MAPEO)) {
    const concepto = await prisma.concepto.findUnique({ where: { codigo: codigoConcepto } });
    if (!concepto) { console.log(`⚠ "${codigoConcepto}" no existe en la base — se salta.`); continue; }

    await prisma.concepto.update({ where: { id: concepto.id }, data: { codigoArca: info.codigo } });
    const marca = info.confirmado ? "✔" : "⚠ PROVISORIO";
    console.log(`${marca} ${codigoConcepto} → ${info.codigo} (${info.fuente})`);
    if (info.confirmado) confirmados++; else provisorios++;
  }

  // HS_AUSENCIAS y HS_NORMALES/HORAS_TRABAJADAS_CARGADAS NO se mapean acá
  // a propósito — se manejan con lógica especial en la exportación LSD
  // (ver 72-lsd-codigos-arca.md), no con un codigoArca fijo.

  // Chequeo: ¿algún concepto usado en reglas reales no tiene mapeo?
  const todosLosConceptos = await prisma.concepto.findMany({
    where: { tipo: { in: ["remunerativo", "no_remunerativo", "descuento"] } },
  });
  for (const c of todosLosConceptos) {
    if (!MAPEO[c.codigo] && c.codigo !== "HS_AUSENCIAS" && c.codigo !== "HS_NORMALES") {
      sinMapeo.push(c.codigo);
    }
  }

  console.log(`\n${confirmados} confirmado(s), ${provisorios} provisorio(s).`);
  if (sinMapeo.length > 0) {
    console.log(`\n⚠️ Estos conceptos NO tienen ningún mapeo todavía (ni confirmado ni provisorio):`);
    for (const c of sinMapeo) console.log(`   - ${c}`);
  }
  console.log("\nLos provisorios van a funcionar para generar el TXT, pero confirmalos antes de presentar algo real.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
