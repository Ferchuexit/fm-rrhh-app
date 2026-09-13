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
  const cargos: { nombre: string; nivel: string; modalidad: string | null; indice: number; unidades: number; tipo: string; divisorHoraCatedra: number | null }[] = [
    { nombre: "Maestro de Grado", nivel: "Primaria", modalidad: "Jornada Completa - 8 hs", indice: 1.1, unidades: 2, tipo: "cargo", divisorHoraCatedra: null },
    { nombre: "Maestro de Grado", nivel: "Primaria", modalidad: "Jornada Extendida/Doble Escolaridad - 6 hs", indice: 1.1, unidades: 1.75, tipo: "cargo", divisorHoraCatedra: null },
    { nombre: "Preceptor", nivel: "Primaria", modalidad: "Jornada Completa - 8 hs", indice: 1.0, unidades: 2, tipo: "cargo", divisorHoraCatedra: null },
    { nombre: "Preceptor", nivel: "Primaria", modalidad: "Jornada Extendida/Doble Escolaridad - 6 hs", indice: 1.0, unidades: 1.75, tipo: "cargo", divisorHoraCatedra: null },
    // Profesor por hora cátedra — Secundaria. BASICO = (valorPorIndice / 15)
    // × cantidad de horas. Confirmado con horas=4 ($93.251,47) y horas=8
    // ($186.502,93), exacto en los dos. El campo "indice" no se usa para
    // este tipo (queda en 1 solo para no dejarlo null en una columna que
    // no admite null) — lo real es divisorHoraCatedra.
    { nombre: "Profesor", nivel: "Secundaria", modalidad: null, indice: 1.0, unidades: 1, tipo: "hora_catedra", divisorHoraCatedra: 15 },
  ];
  for (const c of cargos) {
    const existente = await prisma.docCargo.findFirst({ where: { nombre: c.nombre, nivel: c.nivel, modalidad: c.modalidad } });
    if (!existente) {
      await prisma.docCargo.create({ data: c });
      console.log(`✔ DocCargo: ${c.nombre} — ${c.nivel} — ${c.modalidad ?? c.tipo} (${c.tipo === "hora_catedra" ? `divisor ${c.divisorHoraCatedra}` : `índice ${c.indice}, unidades ${c.unidades}`})`);
    } else {
      // También actualiza — mismo motivo que con los conceptos: una
      // corrección al script no debe quedarse sin propagar a una base ya
      // sembrada.
      await prisma.docCargo.update({ where: { id: existente.id }, data: c });
      console.log(`✔ DocCargo ${c.nombre}/${c.modalidad ?? c.tipo}: actualizado`);
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
    // FIX 13/09/2026: estos son los valores de BASE (1 unidad) — el ×2 de
    // Jornada Completa/Extendida vive en el motor (multiplicadorFijo), no
    // acá. Guardarlos ya multiplicados rompía el cálculo de Profesor
    // (hora cátedra), que necesita la base sin multiplicar para dividir
    // por 15 y escalar con la cantidad de horas real.
    { codigo: "438", nombre: "BONIF. REMUN. DOCENTE 2014", modoCalculo: "fijo_por_unidad", aplicaANivel: "Primaria", aplicaACargoNombre: "Maestro de Grado", aportaAportes: true, valor: 278750.0 },
    { codigo: "455", nombre: "BONIF. REMUN. DOC. 08/2008", modoCalculo: "fijo_por_unidad", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: true, valor: 141881.0 },
    // 641 sigue siendo la excepción — su valor de base YA es el que usa
    // Preceptor (fijo), y el motor lo multiplica aparte para Maestro. No
    // se toca acá.
    { codigo: "641", nombre: "BONIF. 1ER Y 2DO CICLO", modoCalculo: "fijo_por_unidad", aplicaANivel: "Primaria", aplicaACargoNombre: null, aportaAportes: true, valor: 234294.31 },
    { codigo: "2575", nombre: "Comp. FONID/Conectividad", modoCalculo: "fijo_por_unidad", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: false, valor: 30709.0 },
    { codigo: "624", nombre: "RURAL", modoCalculo: "porcentaje_basico", aplicaANivel: null, aplicaACargoNombre: null, aportaAportes: true, valor: 30.0 },
    // 667 aplica SOLO a Secundaria (hora cátedra) — confirmado que no
    // corresponde para Primaria (Maestro de Grado/Preceptor).
    { codigo: "667", nombre: "B.R.N.B ap 1/3/14", modoCalculo: "porcentaje_basico", aplicaANivel: "Secundaria", aplicaACargoNombre: null, aportaAportes: true, valor: 43.5 },
  ];
  for (const c of conceptos) {
    const concepto = await prisma.docConcepto.upsert({
      where: { codigo: c.codigo },
      update: { nombre: c.nombre, modoCalculo: c.modoCalculo, aplicaANivel: c.aplicaANivel, aplicaACargoNombre: c.aplicaACargoNombre, aportaAportes: c.aportaAportes },
      create: { codigo: c.codigo, nombre: c.nombre, modoCalculo: c.modoCalculo, aplicaANivel: c.aplicaANivel, aplicaACargoNombre: c.aplicaACargoNombre, aportaAportes: c.aportaAportes },
    });
    // FIX 13/09/2026: antes, si ya existía un valor para esa fecha, se
    // salteaba sin tocarlo — eso significaba que corregir un monto acá
    // (como pasó con 455) nunca llegaba a una base ya sembrada. Ahora
    // actualiza siempre el valor vigente para esa fecha exacta.
    const valorExistente = await prisma.docValorConcepto.findFirst({ where: { docConceptoId: concepto.id, vigenciaDesde: new Date("2026-08-01") } });
    if (!valorExistente) {
      await prisma.docValorConcepto.create({ data: { docConceptoId: concepto.id, vigenciaDesde: new Date("2026-08-01"), valor: c.valor } });
      console.log(`✔ DocConcepto ${c.codigo} (${c.nombre}): ${c.modoCalculo} = ${c.valor}`);
    } else if (Number(valorExistente.valor) !== c.valor) {
      await prisma.docValorConcepto.update({ where: { id: valorExistente.id }, data: { valor: c.valor } });
      console.log(`✔ DocConcepto ${c.codigo}: actualizado de ${valorExistente.valor} a ${c.valor}`);
    } else {
      console.log(`… DocConcepto ${c.codigo} ya tenía el valor correcto, no se tocó`);
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
