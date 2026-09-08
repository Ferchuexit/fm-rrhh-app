// FM RRHH — prisma/crear-contribuciones-patronales-nacionales.ts
// Las 2 de 4 contribuciones patronales que se pudieron confirmar con fuente
// oficial, porque son de ley NACIONAL — aplican igual sin importar el
// convenio (Madera, Comercio, Excluido):
//
//   - Jubilación (SIPA + INSSJP + FNE + Asignaciones Familiares, combinado):
//     18% — Ley 27.541 art. 19, alícuota para PyMEs/industria con
//     certificado MiPyME. Confirmado cruzando ARCA + 2 fuentes más.
//   - Obra Social (contribución patronal): 6% — Ley 23.660, tasa estable.
//
// Las otras 2 (ART, Seguro de Vida Colectivo) NO se cargan acá — dependen
// de con qué aseguradora trabaja Moras y de un monto que fija
// periódicamente la Superintendencia de Seguros, no de una ley general.
// Ver 56-contribuciones-patronales.md.
import { PrismaClient } from "@prisma/client";
import { sugerirProximoNumero } from "../lib/motor/catalogo-conceptos.mjs";

const prisma = new PrismaClient();
const VIGENCIA_DESDE = new Date("2026-01-01");

const CONTRIBUCIONES = [
  { codigo: "CONTRIB_JUBILACION", nombre: "Contribución Jubilación (SIPA/INSSJP/FNE/AAFF)", rubro: "seguridad_social", formula: "REM_TOTAL() * 0.18" },
  { codigo: "CONTRIB_OBRA_SOCIAL", nombre: "Contribución Obra Social (patronal)", rubro: "obra_social", formula: "REM_TOTAL() * 0.06" },
];

async function main() {
  const convenios = await prisma.convenio.findMany();

  for (const c of CONTRIBUCIONES) {
    let concepto = await prisma.concepto.findUnique({ where: { codigo: c.codigo } });
    if (!concepto) {
      const rangos = await prisma.rangoNumeracion.findMany();
      const conceptosExistentes = await prisma.concepto.findMany();
      const numero = sugerirProximoNumero("contribucion_patronal", rangos, conceptosExistentes as any) ??
        sugerirProximoNumero("descuento", rangos, conceptosExistentes as any); // fallback si no hay rango propio para contribuciones
      concepto = await prisma.concepto.create({
        data: { codigo: c.codigo, nombre: c.nombre, tipo: "contribucion_patronal", unidad: "monto", rubro: c.rubro, numero },
      });
      console.log(`✔ Concepto "${c.codigo}" creado.`);
    }

    for (const conv of convenios) {
      const existente = await prisma.reglaConcepto.findFirst({ where: { conceptoId: concepto.id, convenioId: conv.id, vigenciaHasta: null } });
      if (existente) { console.log(`"${c.codigo}" ya estaba cargado para ${conv.codigo} — sin cambios.`); continue; }
      await prisma.reglaConcepto.create({
        data: { conceptoId: concepto.id, convenioId: conv.id, vigenciaDesde: VIGENCIA_DESDE, formula: c.formula, aporta: false, contribuye: false },
      });
      console.log(`✔ "${c.codigo}" cargado para ${conv.codigo}.`);
    }
  }

  console.log("\n⚠️ Recordatorio: siguen faltando ART y Seguro de Vida Colectivo — ver 56-contribuciones-patronales.md.");
  console.log("Volvé a liquidar (cualquier convenio) para que las contribuciones aparezcan en el recibo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
