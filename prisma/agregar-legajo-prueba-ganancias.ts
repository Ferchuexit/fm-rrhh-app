// FM RRHH — prisma/agregar-legajo-prueba-ganancias.ts
//
// Legajo ficticio, con básico ALTO A PROPÓSITO (muy por encima de
// cualquier categoría real que cargamos), para ver la Retención de
// Ganancias dispararse en un solo mes, sin esperar varios meses de
// acumulado. No es un sueldo real de ninguna categoría de convenio — es
// puramente para la prueba.
//
// Vive en la misma "TRANSPORTES DE PRUEBA S.A." que ya usamos para
// Camioneros, bajo una categoría de prueba nueva.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VIGENCIA = new Date("2026-08-01");

async function main() {
  const empresa = await prisma.empresa.findUnique({ where: { cuit: "30-00000000-1" } });
  if (!empresa) { console.log("⚠ No existe la empresa de prueba — correr primero crear-empresa-prueba-camioneros.ts."); return; }

  const convenio = await prisma.convenio.findUnique({ where: { codigo: "40/89" } });
  if (!convenio) { console.log("⚠ No existe el convenio Camioneros — correr primero cargar-convenio-camioneros.ts."); return; }

  let categoria = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, codigo: "GERENTE_PRUEBA" } });
  if (!categoria) {
    categoria = await prisma.categoria.create({
      data: { convenioId: convenio.id, codigo: "GERENTE_PRUEBA", nombre: "Gerente (categoría ficticia, solo para probar Ganancias)" },
    });
    console.log("✔ Categoría de prueba creada: GERENTE_PRUEBA");
  }

  const yaExisteEscala = await prisma.escala.findFirst({ where: { categoriaId: categoria.id, vigenciaDesde: VIGENCIA } });
  if (!yaExisteEscala) {
    await prisma.escala.create({
      data: { convenioId: convenio.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA, basico: 25000000, valorHora: 0 },
    });
    console.log("✔ Escala de prueba cargada: básico $25.000.000 (ficticio, muy por encima de cualquier categoría real).");
    console.log("  OJO: elegido así de alto a propósito — con un básico más bajo, como este legajo recién nace");
    console.log("  en el sistema este mes (sin saldo inicial de enero-julio), las deducciones acumuladas de");
    console.log("  8 meses de la tabla de agosto superan la ganancia de UN SOLO mes acumulado. Es el caso real");
    console.log("  de 'saldo inicial' que quedó pendiente — acá lo salteamos subiendo el sueldo, no arreglando eso.");
  }

  const NUMERO_LEGAJO = 9007;
  let legajo = await prisma.legajo.findFirst({ where: { empresaId: empresa.id, numeroLegajo: NUMERO_LEGAJO } });
  if (!legajo) {
    legajo = await prisma.legajo.create({
      data: {
        empresaId: empresa.id, numeroLegajo: NUMERO_LEGAJO,
        cuil: "20-90070000-0",
        apellido: "TESTIGO", nombre: "GANANCIAS ALTA (casado, 2 hijos)",
        fechaIngreso: new Date("2020-01-01"),
        convenioId: convenio.id, categoriaId: categoria.id,
        obraSocialId: "105804 - O.S. DE CHOFERES DE CAMIONES",
        estadoCivil: "Casado/a",
        condicion: "activo",
      },
    });
    console.log(`✔ Legajo ${NUMERO_LEGAJO} creado: TESTIGO, GANANCIAS ALTA`);
  } else {
    console.log(`Legajo ${NUMERO_LEGAJO} ya existía — sin cambios.`);
  }

  // Cargas de familia: cónyuge + 2 hijos, vigentes desde el ingreso.
  const cargasAcrear: { tipo: string; descripcion: string }[] = [
    { tipo: "conyuge", descripcion: "Cónyuge de prueba" },
    { tipo: "hijo", descripcion: "Hijo de prueba 1" },
    { tipo: "hijo", descripcion: "Hijo de prueba 2" },
  ];
  for (const c of cargasAcrear) {
    const yaExiste = await prisma.cargaFamiliarGanancias.findFirst({
      where: { legajoId: legajo.id, tipo: c.tipo, descripcion: c.descripcion },
    });
    if (!yaExiste) {
      await prisma.cargaFamiliarGanancias.create({
        data: { legajoId: legajo.id, tipo: c.tipo, descripcion: c.descripcion, vigenciaDesde: legajo.fechaIngreso },
      });
      console.log(`  ✔ Carga de familia agregada: ${c.tipo} (${c.descripcion})`);
    }
  }

  // ── Valores por categoría que Camioneros necesita, aunque este legajo
  // nunca vaya a usarlos — el motor evalúa TODAS las reglas del convenio
  // para cada legajo, tenga o no la novedad cargada. Sin esto, la
  // liquidación falla con "VALOR_CATEGORIA(...) no está definido" — el
  // mismo error que tendría una categoría real mal cargada (correcto: es
  // mejor un error claro que un $0 escondido). Valores derivados
  // proporcionalmente del básico ficticio, no representan nada real.
  const jornalDiario = 25000000 / 24;
  const valorHora = 25000000 / (24 * 8);
  const valoresPorCategoria: { codigo: string; valor: number }[] = [
    { codigo: "HS_EXTRA_50", valor: valorHora * 1.5 },
    { codigo: "HS_EXTRA_100", valor: valorHora * 2 },
    { codigo: "DIA_CAMIONERO", valor: jornalDiario },
  ];
  for (const v of valoresPorCategoria) {
    const concepto = await prisma.concepto.findUnique({ where: { codigo: v.codigo } });
    if (!concepto) continue;
    const yaExisteValor = await prisma.valorConceptoCategoria.findFirst({
      where: { conceptoId: concepto.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA },
    });
    if (!yaExisteValor) {
      await prisma.valorConceptoCategoria.create({
        data: { conceptoId: concepto.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA, valor: v.valor },
      });
      console.log(`  ✔ Valor de categoría cargado: ${v.codigo} = $${v.valor.toFixed(2)}`);
    }
  }

  console.log(`
Listo. Legajo ${NUMERO_LEGAJO} en "TRANSPORTES DE PRUEBA S.A.", básico ficticio $25.000.000, casado con 2 hijos.
Liquidalo para el período de agosto de 2026 — debería aparecer RETENCION_GANANCIAS en el recibo.
`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
