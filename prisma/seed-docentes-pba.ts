// FM RRHH — prisma/seed-docentes-pba.ts
//
// Carga los datos de referencia de Docentes PBA — Fase 1 (Maestro de
// Grado + Preceptor, Primaria). Todo confirmado contra la calculadora
// oficial de FEB (calculadora.feb.org.ar), período agosto 2026, no
// inventado. Ver el chat del 12-13/09/2026 para el detalle de cada caso
// usado para confirmar cada valor.
//
// Idempotente — usa upsert en todo, se puede correr de nuevo sin
// duplicar filas. Correr con: npx tsx prisma/seed-docentes-pba.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("── Docentes PBA — Fase 1: cargando datos de referencia ──\n");

  // ── 1. Valor del índice ──
  // $349.693 desde 01/08/2026 — es el básico de Preceptor (índice 1.00,
  // cargo testigo del nomenclador, Decreto 2022/2006), confirmado porque
  // Maestro de Grado (índice 1.10) da 349.693 × 1.10 = 384.662,30 exacto
  // contra el recibo real.
  const valorIndiceExistente = await prisma.docValorIndice.findFirst({
    where: { vigenciaDesde: new Date("2026-08-01") },
  });
  if (!valorIndiceExistente) {
    await prisma.docValorIndice.create({
      data: { vigenciaDesde: new Date("2026-08-01"), valorPorIndice: 349693.0 },
    });
    console.log("✔ DocValorIndice: $349.693 desde 01/08/2026");
  } else {
    console.log("… DocValorIndice de 01/08/2026 ya existía, no se tocó");
  }

  // ── 2. Nomenclador de cargos — Fase 1: Maestro de Grado + Preceptor, Primaria ──
  // El índice es el mismo para las dos modalidades de un mismo cargo — lo
  // que cambia es "unidades" (el factor que multiplica al índice para dar
  // el BASICO). Confirmado: Jornada Completa = 2, Jornada Extendida = 1,75
  // (misma proporción 8hs→6hs = 0,875 que separa los dos básicos reales).
  const cargos = [
    { nombre: "Maestro de Grado", nivel: "Primaria", modalidad: "Jornada Completa - 8 hs", indice: 1.1, unidades: 2 },
    { nombre: "Maestro de Grado", nivel: "Primaria", modalidad: "Jornada Extendida/Doble Escolaridad - 6 hs", indice: 1.1, unidades: 1.75 },
    { nombre: "Preceptor", nivel: "Primaria", modalidad: "Jornada Completa - 8 hs", indice: 1.0, unidades: 2 },
    { nombre: "Preceptor", nivel: "Primaria", modalidad: "Jornada Extendida/Doble Escolaridad - 6 hs", indice: 1.0, unidades: 1.75 },
  ];
  for (const c of cargos) {
    const existente = await prisma.docCargo.findFirst({ where: { nombre: c.nombre, nivel: c.nivel, modalidad: c.modalidad } });
    if (!existente) {
      await prisma.docCargo.create({ data: c });
      console.log(`✔ DocCargo: ${c.nombre} — ${c.nivel} — ${c.modalidad} (índice ${c.indice}, unidades ${c.unidades})`);
    } else {
      console.log(`… DocCargo ${c.nombre}/${c.modalidad} ya existía, no se tocó`);
    }
  }

  // ── 3. Tabla de antigüedad — completa, 11 tramos + el 0 implícito ──
  // Universal entre cargos (Maestro, Preceptor y Profesor dan el mismo %
  // en cada tramo) — verificado con 13 casos reales, sin huecos.
  const tramos = [
    { aniosDesde: 0, porcentaje: 0 },
    { aniosDesde: 1, porcentaje: 21 },
    { aniosDesde: 2, porcentaje: 24 },
    { aniosDesde: 4, porcentaje: 33 },
    { aniosDesde: 7, porcentaje: 43 },
    { aniosDesde: 10, porcentaje: 54 },
    { aniosDesde: 12, porcentaje: 64 },
    { aniosDesde: 15, porcentaje: 74 },
    { aniosDesde: 17, porcentaje: 84 },
    { aniosDesde: 20, porcentaje: 105 },
    { aniosDesde: 22, porcentaje: 115 },
    { aniosDesde: 24, porcentaje: 125 },
  ];
  for (const t of tramos) {
    const existente = await prisma.docTramoAntiguedad.findFirst({ where: { aniosDesde: t.aniosDesde } });
    if (!existente) {
      await prisma.docTramoAntiguedad.create({ data: t });
      console.log(`✔ DocTramoAntiguedad: desde ${t.aniosDesde} año(s) → ${t.porcentaje}%`);
    } else {
      console.log(`… DocTramoAntiguedad de ${t.aniosDesde} año(s) ya existía, no se tocó`);
    }
  }

  // ── 4. Conceptos y sus valores (agosto 2026) ──
  // modoCalculo:
  //   'fijo_por_unidad'   → monto fijo × cantidadModulos (solo importa
  //                          para hora_catedra — en 'cargo' siempre es 1)
  //   'porcentaje_basico' → % sobre el BASICO ya calculado
  // Todos confirmados contra recibos reales, EXCEPTO ninguno queda
  // "adivinado" acá — lo que no se pudo cerrar (GARANTÍA) no se carga.
  const conceptos: {
    codigo: string;
    nombre: string;
    modoCalculo: string;
    aplicaANivel: string | null;
    aplicaACargoNombre: string | null;
    aportaAportes: boolean;
    valor: number;
  }[] = [
    { codigo: "438", nombre: "BONIF. REMUN. DOCENTE 2014", modoCalculo: "fijo_por_unidad", aplicaANivel: "Primaria", aplicaACargoNombre: "Maestro de Grado", aportaAportes: true, valor: 557500.0 },
    // FASE 1 — alcance: Jornada Completa solamente. El valor de 455 acá
    // es el de Jornada Completa ($283.762); confirmamos que NO escala
    // proporcional con las "unidades" del cargo (Jornada Extendida da el
    // mismo monto, no 1,75× de un valor menor) — es un escalón, no una
    // fórmula lineal. Jornada Extendida queda pendiente de resolver.
    { codigo: "455", nombre: "BONIF. REMUN. DOC. 08/2008", modoCalculo: "fijo_por_unidad", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: true, valor: 283762.0 },
    // 641 varía por CARGO, no por unidades — Preceptor cobra
    // $234.294,31 (el valor acá), Maestro de Grado cobra exactamente el
    // doble ($468.588,62) — el motor aplica ese ×2 como caso especial
    // confirmado, no como fórmula general. Ver motor-docentes-pba.mjs.
    { codigo: "641", nombre: "BONIF. 1ER Y 2DO CICLO", modoCalculo: "fijo_por_unidad", aplicaANivel: "Primaria", aplicaACargoNombre: null, aportaAportes: true, valor: 234294.31 },
    // 2575 confirmado AL CENTAVO como no aportable (ver chat 13/09) — el
    // resto queda con aportaAportes=true por default, asumido "sí aporta"
    // (no confirmado con un caso puntual con RURAL/667 activos todavía).
    { codigo: "2575", nombre: "Comp. FONID/Conectividad", modoCalculo: "fijo_por_unidad", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: false, valor: 61418.0 },
    { codigo: "624", nombre: "RURAL", modoCalculo: "porcentaje_basico", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: true, valor: 30.0 },
    { codigo: "667", nombre: "B.R.N.B ap 1/3/14", modoCalculo: "porcentaje_basico", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: true, valor: 43.5 },
  ];
  for (const c of conceptos) {
    const concepto = await prisma.docConcepto.upsert({
      where: { codigo: c.codigo },
      update: { nombre: c.nombre, modoCalculo: c.modoCalculo, aplicaANivel: c.aplicaANivel, aplicaACargoNombre: c.aplicaACargoNombre, aportaAportes: c.aportaAportes },
      create: { codigo: c.codigo, nombre: c.nombre, modoCalculo: c.modoCalculo, aplicaANivel: c.aplicaANivel, aplicaACargoNombre: c.aplicaACargoNombre, aportaAportes: c.aportaAportes },
    });
    const valorExistente = await prisma.docValorConcepto.findFirst({ where: { docConceptoId: concepto.id, vigenciaDesde: new Date("2026-08-01") } });
    if (!valorExistente) {
      await prisma.docValorConcepto.create({ data: { docConceptoId: concepto.id, vigenciaDesde: new Date("2026-08-01"), valor: c.valor } });
      console.log(`✔ DocConcepto ${c.codigo} (${c.nombre}): ${c.modoCalculo} = ${c.valor}`);
    } else {
      console.log(`… DocConcepto ${c.codigo} ya tenía valor vigente para 01/08/2026, no se tocó`);
    }
  }

  console.log("\n── Listo. IPS (16%) e IOMA (4,8%) se calculan directo en el motor, no viven acá — ver nota en el schema. ──");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
