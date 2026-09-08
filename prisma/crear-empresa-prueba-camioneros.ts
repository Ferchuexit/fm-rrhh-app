// FM RRHH — prisma/crear-empresa-prueba-camioneros.ts
//
// Empresa 100% ficticia, separada de Moras, para validar el convenio
// Camioneros antes de usarlo con un cliente real. Los legajos NO son
// "empleados típicos" — cada uno está armado a propósito para forzar una
// fórmula distinta de las que cargamos (ver comentario en cada uno).
//
// Después de correr esto: andá a /periodos, abrí el período creado, cargá
// las novedades sugeridas en la consola, liquidá desde /liquidar, y
// comparás CADA CONCEPTO del recibo (no solo el neto) contra la cuenta a
// mano de abajo.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HOY = new Date();

async function main() {
  // ── 1. Empresa de prueba ──
  const empresa = await prisma.empresa.upsert({
    where: { cuit: "30-00000000-1" },
    update: {},
    create: {
      cuit: "30-00000000-1",
      razonSocial: "TRANSPORTES DE PRUEBA S.A. (empresa ficticia — no usar en producción)",
      nombreFantasia: "Prueba Camioneros",
    },
  });
  console.log(`✔ Empresa de prueba: ${empresa.razonSocial}`);

  const convenio = await prisma.convenio.findUnique({ where: { codigo: "40/89" } });
  if (!convenio) { console.log("⚠ No existe el convenio Camioneros (40/89) — correr primero cargar-convenio-camioneros.ts."); return; }

  async function categoriaPorCodigo(codigo: string) {
    const c = await prisma.categoria.findFirst({ where: { convenioId: convenio!.id, codigo } });
    if (!c) throw new Error(`No existe la categoría "${codigo}" en Camioneros.`);
    return c;
  }

  const OBRA_SOCIAL_CAMIONEROS = "105804 - O.S. DE CHOFERES DE CAMIONES";

  // ── 2. Legajos ficticios — cada uno prueba algo puntual ──
  const legajosAcrear = [
    {
      numeroLegajo: 9001,
      apellido: "TESTIGO", nombre: "SIN ANTIGÜEDAD",
      categoria: "COND1",
      fechaIngreso: new Date(HOY.getFullYear(), HOY.getMonth(), 1), // recién ingresado
      nota: "Antigüedad = 0. El recibo NO debería tener ningún importe en ANTIGUEDAD.",
    },
    {
      numeroLegajo: 9002,
      apellido: "TESTIGO", nombre: "VEINTE AÑOS",
      categoria: "COND1",
      fechaIngreso: new Date(HOY.getFullYear() - 20, 0, 1),
      nota: "Antigüedad = 20 años → ANTIGUEDAD debería dar básico × 20 × 0,01 = básico × 0,20.",
    },
    {
      numeroLegajo: 9003,
      apellido: "TESTIGO", nombre: "HORAS EXTRA",
      categoria: "PEON",
      fechaIngreso: new Date(HOY.getFullYear() - 3, 0, 1),
      nota: "Cargarle una Novedad de HS_EXTRA_50 con cantidad=8 → debería dar 8 × $7.676,89 = $61.415,12. Y otra de HS_EXTRA_100 con cantidad=4 → 4 × $10.235,85 = $40.943,40.",
    },
    {
      numeroLegajo: 9004,
      apellido: "TESTIGO", nombre: "VACACIONES",
      categoria: "ADMIN1",
      fechaIngreso: new Date(HOY.getFullYear() - 5, 0, 1),
      nota: "Cargarle una Novedad de ADICIONAL_VACACIONES con cantidad=14 (días gozados) → 14 × $25.132,45 = $351.854,30.",
    },
    {
      numeroLegajo: 9005,
      apellido: "TESTIGO", nombre: "DIA DEL CAMIONERO",
      categoria: "OF1TALLER",
      fechaIngreso: new Date(HOY.getFullYear() - 2, 0, 1),
      nota: "Cargarle una Novedad de DIA_CAMIONERO con cantidad=2 (trabajado en día de semana) → 2 × $49.928,06 (jornal de Oficial de Primera) = $99.856,12.",
    },
    {
      numeroLegajo: 9006,
      apellido: "TESTIGO", nombre: "MUCHOS AÑOS",
      categoria: "OF1TALLER",
      fechaIngreso: new Date(HOY.getFullYear() - 30, 0, 1),
      nota: "Antigüedad = 30 años, la categoría con el básico más alto que cargamos. Sirve para confirmar que ANTIGUEDAD escala bien incluso en el caso más extremo que tenemos — igual queda MUY por debajo del tope jubilatorio real (~$4.594.798), así que no esperes que el tope entre en juego con este convenio a estos niveles de sueldo.",
    },
  ];

  for (const l of legajosAcrear) {
    const categoria = await categoriaPorCodigo(l.categoria);
    const yaExiste = await prisma.legajo.findFirst({ where: { empresaId: empresa.id, numeroLegajo: l.numeroLegajo } });
    if (yaExiste) {
      console.log(`  Legajo ${l.numeroLegajo} (${l.nombre}) ya existía — sin cambios.`);
      continue;
    }
    await prisma.legajo.create({
      data: {
        empresaId: empresa.id,
        numeroLegajo: l.numeroLegajo,
        cuil: `20-${String(l.numeroLegajo).padStart(8, "0")}-0`, // CUIL ficticio, no válido para AFIP real
        apellido: l.apellido, nombre: l.nombre,
        fechaIngreso: l.fechaIngreso,
        convenioId: convenio.id, categoriaId: categoria.id,
        obraSocialId: OBRA_SOCIAL_CAMIONEROS,
        condicion: "activo",
      },
    });
    console.log(`  ✔ Legajo ${l.numeroLegajo} — ${l.apellido}, ${l.nombre} (${l.categoria}). ${l.nota}`);
  }

  // ── 3. Período de prueba (mes actual) ──
  const desde = new Date(HOY.getFullYear(), HOY.getMonth(), 1);
  const hasta = new Date(HOY.getFullYear(), HOY.getMonth() + 1, 0);
  const nombrePeriodo = `Prueba Camioneros — ${desde.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}`;

  let periodo = await prisma.periodo.findFirst({ where: { empresaId: empresa.id, nombre: nombrePeriodo } });
  if (!periodo) {
    periodo = await prisma.periodo.create({
      data: { empresaId: empresa.id, nombre: nombrePeriodo, fechaDesde: desde, fechaHasta: hasta, convenioId: convenio.id, estado: "borrador" },
    });
    console.log(`✔ Período creado: "${nombrePeriodo}"`);
  } else {
    console.log(`Período "${nombrePeriodo}" ya existía — sin cambios.`);
  }

  console.log(`
Listo. Próximos pasos:
  1. Andá a /novedades y cargá, para el período "${nombrePeriodo}":
     - Legajo 9003: HS_EXTRA_50 cantidad 8, HS_EXTRA_100 cantidad 4
     - Legajo 9004: ADICIONAL_VACACIONES cantidad 14
     - Legajo 9005: DIA_CAMIONERO cantidad 2
  2. Andá a /liquidar, elegí ese período, liquidá los 6 legajos de prueba.
  3. Abrí cada recibo y comparalo, CONCEPTO POR CONCEPTO, contra la nota que
     te dejé arriba en la consola para cada legajo — no solo mires el neto.
`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
