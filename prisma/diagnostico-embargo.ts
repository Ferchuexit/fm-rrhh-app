// FM RRHH — prisma/diagnostico-embargo.ts
//
// Diagnóstico de solo lectura (no cambia nada) para cerrar los cabos
// sueltos del 08/09/2026: confirma que EMBARGO_JUDICIAL/EMBARGO_COMERCIAL
// ya no tienen fórmula, lista TODOS los TOPE() que el convenio del legajo
// referencia y cuáles faltan cargar en /parametros, y muestra el estado
// real de los embargos cargados (Embargo + CuotaEmbargo) para el legajo.
//
// Uso:
//   npx tsx prisma/diagnostico-embargo.ts 9007
//   npx tsx prisma/diagnostico-embargo.ts 9007 2026-08-01   (período puntual)
import { PrismaClient } from "@prisma/client";
import { extraerTopesReferenciados } from "../lib/motor/motor-reglas.mjs";

const prisma = new PrismaClient();
const CODIGOS_SIN_FORMULA = ["SAC", "SAC_PROPORCIONAL", "RETENCION_GANANCIAS", "EMBARGO_JUDICIAL", "EMBARGO_COMERCIAL"];

async function main() {
  const numeroLegajo = Number(process.argv[2]);
  const fechaArg = process.argv[3];
  if (!numeroLegajo) {
    console.log('Uso: npx tsx prisma/diagnostico-embargo.ts <numeroLegajo> [YYYY-MM-DD]');
    return;
  }

  const legajo = await prisma.legajo.findFirst({ where: { numeroLegajo }, include: { convenio: true, empresa: true } });
  if (!legajo) { console.log(`✕ No existe ningún legajo con número ${numeroLegajo}.`); return; }
  console.log(`Legajo ${legajo.numeroLegajo} — ${legajo.apellido}, ${legajo.nombre} — ${legajo.empresa.razonSocial} — convenio ${legajo.convenio.codigo}\n`);

  const periodo = fechaArg
    ? await prisma.periodo.findFirst({ where: { empresaId: legajo.empresaId, fechaDesde: new Date(fechaArg) } })
    : await prisma.periodo.findFirst({ where: { empresaId: legajo.empresaId }, orderBy: { fechaDesde: "desc" } });
  if (!periodo) { console.log("✕ No encontré ningún período para probar."); return; }
  console.log(`Período: ${periodo.nombre} (${periodo.fechaDesde.toISOString().slice(0, 10)} a ${periodo.fechaHasta.toISOString().slice(0, 10)})\n`);

  // ── 1) ¿Los conceptos especiales siguen sin fórmula? ──
  console.log("── 1) Fórmulas de SAC/Ganancias/Embargos (tienen que ser CERO) ──");
  const reglasEspeciales = await prisma.reglaConcepto.findMany({
    where: { concepto: { codigo: { in: CODIGOS_SIN_FORMULA } }, vigenciaHasta: null },
    include: { concepto: true, convenio: true },
  });
  if (reglasEspeciales.length === 0) {
    console.log("✔ Ninguno de los 5 códigos especiales tiene una fórmula vigente. Correcto.\n");
  } else {
    for (const r of reglasEspeciales) {
      console.log(`✕ "${r.concepto.codigo}" TODAVÍA tiene una fórmula para ${r.convenio.codigo}: ${r.formula}`);
      console.log(`   Borrala desde /conceptos → desplegar "Fórmula" → "Eliminar esta regla".`);
    }
    console.log();
  }

  // ── 2) Topes que el convenio referencia vs. los que existen ──
  console.log("── 2) TOPE() que este convenio usa, y si están cargados en /parametros ──");
  const reglasDelConvenio = await prisma.reglaConcepto.findMany({
    where: { convenioId: legajo.convenioId, vigenciaHasta: null },
    include: { concepto: true },
  });
  const topesReferenciados = new Set<string>();
  for (const r of reglasDelConvenio) {
    for (const clave of extraerTopesReferenciados(r.formula)) topesReferenciados.add(clave);
  }
  const parametros = await prisma.parametroVigente.findMany();
  let faltanTopes = false;
  for (const clave of topesReferenciados) {
    const vigentesParaEsePeriodo = parametros.filter(
      (p) => p.clave === clave && p.vigenciaDesde <= periodo.fechaDesde && (p.vigenciaHasta == null || p.vigenciaHasta >= periodo.fechaDesde)
    );
    if (vigentesParaEsePeriodo.length === 0) {
      const existeEnOtraFecha = parametros.some((p) => p.clave === clave);
      console.log(`✕ TOPE('${clave}') — ${existeEnOtraFecha ? "existe pero NO vigente para este período" : "no está cargado NUNCA"}. Cargalo en /parametros.`);
      faltanTopes = true;
    } else {
      console.log(`✔ TOPE('${clave}') = ${vigentesParaEsePeriodo[0].valor} (vigente)`);
    }
  }
  if (!faltanTopes) console.log("✔ Todos los topes que usa este convenio están cargados para este período.");
  console.log();

  // ── 3) Embargos cargados para este legajo ──
  console.log("── 3) Embargos del legajo ──");
  const embargos = await prisma.embargo.findMany({ where: { legajoId: legajo.id }, include: { cuotas: true } });
  if (embargos.length === 0) {
    console.log("— Este legajo no tiene ningún Embargo cargado.");
  }
  for (const e of embargos) {
    console.log(`${e.tipo === "judicial" ? "⚖️ Judicial" : "🏦 Comercial"} — "${e.descripcion}" — activo: ${e.activo ? "sí" : "NO"}`);
    if (e.tipo === "judicial") console.log(`   Porcentaje: ${e.porcentaje}%`);
    if (e.tipo === "comercial") {
      console.log(`   Monto total: $${e.montoTotal}`);
      const cuotaDelPeriodo = e.cuotas.find((c) => c.anio === periodo.fechaDesde.getUTCFullYear() && c.mes === periodo.fechaDesde.getUTCMonth() + 1);
      if (!cuotaDelPeriodo) {
        console.log(`   ✕ No hay ninguna CuotaEmbargo cargada para ${periodo.fechaDesde.getUTCMonth() + 1}/${periodo.fechaDesde.getUTCFullYear()} — sin esto, el comercial no se va a aplicar este mes aunque el Embargo esté activo.`);
      } else {
        console.log(`   Cuota de este mes: $${cuotaDelPeriodo.importe} — aplicado: ${cuotaDelPeriodo.aplicado ? "SÍ (ya se cobró, no se va a repetir)" : "no todavía"}`);
      }
    }
  }
  console.log();

  // ── 4) Lo que efectivamente quedó guardado en la liquidación vigente de este período ──
  console.log("── 4) Liquidación vigente de este período ──");
  const liquidacion = await prisma.liquidacion.findFirst({
    where: { legajoId: legajo.id, periodoId: periodo.id, vigente: true },
    include: { detalle: { include: { concepto: true } } },
  });
  if (!liquidacion) {
    console.log("— Todavía no está liquidado este período para este legajo.");
  } else {
    const filasEmbargo = liquidacion.detalle.filter((d) => d.concepto.codigo === "EMBARGO_JUDICIAL" || d.concepto.codigo === "EMBARGO_COMERCIAL");
    if (filasEmbargo.length === 0) {
      console.log("— La liquidación vigente NO tiene ninguna fila de embargo todavía.");
    }
    for (const f of filasEmbargo) {
      console.log(`${f.concepto.codigo}: $${f.importe} ${f.forzado ? "(forzado a mano)" : ""} ${f.excluido ? "(EXCLUIDO)" : ""}`);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
