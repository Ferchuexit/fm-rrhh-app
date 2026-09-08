// FM RRHH — prisma/import-catalogo-real.ts
// Paso 3 del plan de datos reales. Carga: rangos de numeración ajustados a
// los códigos reales, conceptos reales (con los números que usa ARCA de
// verdad, sacados de recibos reales), 48 categorías (deduplicadas de 51
// filas del Excel) y 44 escalas con valor real (de 161 filas históricas,
// se toma la vigente más reciente por categoría).
//
// No destructivo — usa upsert por código único en todos lados, se puede
// correr más de una vez sin duplicar nada.
import { PrismaClient } from "@prisma/client";
import datos from "./datos-reales-categorias-escalas.json";

const prisma = new PrismaClient();

// Las fechas de datos-reales-*.json vienen sin zona horaria (ej.
// "2026-07-01T00:00:00") — parsearlas con `new Date(...)` directo las
// interpreta como hora LOCAL de la máquina que corre el script, lo que
// corrió las vigencias unas horas para adelante en cualquier máquina que
// no esté en UTC (como una PC en Argentina, UTC-3) — ver 39-fix-zona-horaria.md.
// Esta función corta el string a solo la fecha (los primeros 10
// caracteres, "YYYY-MM-DD") y la parsea así, que SIEMPRE se interpreta
// como medianoche UTC sin importar la máquina.
function fechaUTC(iso: string): Date {
  return new Date(iso.slice(0, 10));
}

// ── Categorías SIN valor de escala en tu Excel — se cargan igual, pero sin
// escala. El sistema va a rechazar liquidar a cualquiera con estas
// categorías hasta que exista un valor real (ver 33-catalogo-real.md). ──
const CATEGORIAS_SIN_ESCALA = [
  { convenio: "0335/75", nombre: "PEON" }, // 9 empleados activos — el más urgente de resolver
  { convenio: "0130/75", nombre: "MAESTRANZA A 1/2 Jor." }, // 1 empleado, de baja
  { convenio: "0130/75", nombre: "VENDEDOR B" }, // 2 empleados, de baja
  { convenio: "9999/99", nombre: "SIN CATEGORIA" }, // directores — sueldo individual, no hay escala compartida por diseño
];

// ── Conceptos reales — código de ARCA real (numero) y código interno
// (codigo) que usa el motor de reglas en las fórmulas. Los que ya existían
// (REM_BASICA, ANTIGUEDAD, PRESENTISMO) se renumeran al código real; el
// resto son altas nuevas. ──
const CONCEPTOS_REALES = [
  // codigo interno, numero real (ARCA), nombre real, tipo, categoriaNovedad
  { codigo: "REM_BASICA", numero: 1, nombre: "Sueldo básico mensualizados", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" },
  { codigo: "A_CUENTA_AUMENTOS", numero: 8, nombre: "A Cuenta Futuros Aumentos", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" },
  { codigo: "ANTIGUEDAD", numero: 28, nombre: "Antigüedad", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" },
  { codigo: "PRESENTISMO", numero: 34, nombre: "Presentismo", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" },
  { codigo: "AGUINALDO_PROPORCIONAL", numero: 42, nombre: "Aguinaldo Proporcional", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" },
  { codigo: "DIAS_NO_TRAB_VACACIONES", numero: 51, nombre: "Días no trabajados por vacaciones", tipo: "remunerativo", categoriaNovedad: "Licencias y Ausencias" },
  { codigo: "JUBILACION", numero: 20000, nombre: "Jubilación", tipo: "descuento", categoriaNovedad: "Otros" },
  { codigo: "LEY_19032", numero: 20001, nombre: "Ley 19.032", tipo: "descuento", categoriaNovedad: "Otros" },
  { codigo: "OBRA_SOCIAL", numero: 20002, nombre: "Obra social", tipo: "descuento", categoriaNovedad: "Otros" },
  { codigo: "SINDICATO", numero: 20004, nombre: "Sindicato / Faecys", tipo: "descuento", categoriaNovedad: "Otros" },
  { codigo: "OBRA_SOCIAL_JR", numero: 20005, nombre: "Obra social JR", tipo: "descuento", categoriaNovedad: "Otros" },
  { codigo: "SEGURO_MERCANTIL", numero: 20100, nombre: "Seguro Mercantil", tipo: "descuento", categoriaNovedad: "Otros" },
  { codigo: "SEGURO_SEPELIO", numero: 20101, nombre: "Faecys / Seguro Sepelio", tipo: "descuento", categoriaNovedad: "Otros" },
  { codigo: "ACUERDO_NR_MES", numero: 41010, nombre: "Acuerdo No Remunerativo (mes)", tipo: "no_remunerativo", categoriaNovedad: "Básicos y Fijos" },
  { codigo: "ACUERDO_NR_ANTIGUEDAD", numero: 41011, nombre: "Acuerdo No Remunerativo - Antigüedad", tipo: "no_remunerativo", categoriaNovedad: "Básicos y Fijos" },
  { codigo: "ACUERDO_NR_PRESENTISMO", numero: 41012, nombre: "Acuerdo No Remunerativo - Presentismo", tipo: "no_remunerativo", categoriaNovedad: "Básicos y Fijos" },
  { codigo: "AJUSTE_SAC_NR", numero: 41023, nombre: "Ajuste SAC No Remunerativo", tipo: "no_remunerativo", categoriaNovedad: "Otros" },
  // "Retencion" y "Ajuste" (tipos reales del Excel) no existen como tipo acá
  // — se mapean a "descuento", que es como se comportan (restan del neto).
  // Ver 33-catalogo-real.md.
  { codigo: "RETENCION_GANANCIAS", numero: 90000, nombre: "Retención Impuesto a las Ganancias", tipo: "descuento", categoriaNovedad: "Otros" },
  { codigo: "REDONDEO", numero: 99999, nombre: "Redondeo", tipo: "descuento", categoriaNovedad: "Otros" },
];

async function main() {
  // ── 1. Rangos de numeración, ajustados a los códigos reales ──
  const rangos = [
    { tipo: "remunerativo", desde: 1, hasta: 1000 },
    { tipo: "no_remunerativo", desde: 1100, hasta: 42000 },
    { tipo: "descuento", desde: 9000, hasta: 99999 },
  ];
  for (const r of rangos) {
    await prisma.rangoNumeracion.upsert({ where: { tipo: r.tipo }, update: { desde: r.desde, hasta: r.hasta }, create: r });
  }
  console.log(`✔ ${rangos.length} rangos de numeración actualizados a los códigos reales.`);

  // ── 2. Conceptos reales — actualiza numero/nombre si el codigo ya existe, crea si no ──
  let creados = 0, actualizados = 0;
  for (const c of CONCEPTOS_REALES) {
    const existente = await prisma.concepto.findUnique({ where: { codigo: c.codigo } });
    if (existente) {
      await prisma.concepto.update({ where: { codigo: c.codigo }, data: { numero: c.numero, nombre: c.nombre, categoriaNovedad: c.categoriaNovedad } });
      actualizados++;
    } else {
      await prisma.concepto.create({ data: { codigo: c.codigo, numero: c.numero, nombre: c.nombre, tipo: c.tipo, unidad: "monto", categoriaNovedad: c.categoriaNovedad } });
      creados++;
    }
  }
  console.log(`✔ Conceptos reales: ${creados} creados, ${actualizados} actualizados.`);

  // ── 3. Categorías (deduplicadas) ──
  const convenios = await prisma.convenio.findMany();
  const convenioIdPorCodigo = new Map(convenios.map((c) => [c.codigo, c.id]));
  let categoriasCreadas = 0;

  const idCategoriaPorClave = new Map<string, string>(); // "convenio|nombre" -> id, para las escalas

  for (const cat of datos.categorias) {
    const convenioId = convenioIdPorCodigo.get(cat.convenio);
    if (!convenioId) {
      console.log(`⚠ Convenio "${cat.convenio}" no existe en la base — se salta la categoría "${cat.nombre}".`);
      continue;
    }
    const existente = await prisma.categoria.findFirst({ where: { convenioId, nombre: cat.nombre } });
    if (existente) {
      idCategoriaPorClave.set(`${cat.convenio}|${cat.nombre}`, existente.id);
      continue;
    }
    const nueva = await prisma.categoria.create({ data: { convenioId, codigo: cat.nombre.slice(0, 20), nombre: cat.nombre } });
    idCategoriaPorClave.set(`${cat.convenio}|${cat.nombre}`, nueva.id);
    categoriasCreadas++;
  }
  console.log(`✔ Categorías: ${categoriasCreadas} creadas (de ${datos.categorias.length} totales, ya deduplicadas).`);

  // ── 4. Escalas — solo para las categorías con valor real en tu Excel.
  // Madera guarda el valor en valorHora (liquida por hora); Comercio y el
  // resto lo guardan en basico (liquida mensual fijo). ──
  let escalasCreadas = 0;
  for (const esc of datos.escalas) {
    const categoriaId = idCategoriaPorClave.get(`${esc.convenio}|${esc.categoria}`);
    const convenioId = convenioIdPorCodigo.get(esc.convenio);
    if (!categoriaId || !convenioId) continue;

    const yaExiste = await prisma.escala.findFirst({ where: { categoriaId, vigenciaDesde: fechaUTC(esc.vigenciaDesde) } });
    if (yaExiste) continue;

    const esMadera = esc.convenio === "0335/75";
    await prisma.escala.create({
      data: {
        convenioId,
        categoriaId,
        vigenciaDesde: fechaUTC(esc.vigenciaDesde),
        basico: esMadera ? 0 : esc.valor,
        valorHora: esMadera ? esc.valor : 0,
      },
    });
    escalasCreadas++;
  }
  console.log(`✔ Escalas: ${escalasCreadas} creadas.`);

  // ── 5. Categorías sin escala — se crean igual, para que existan como
  // opción al cargar legajos, pero SIN valor — liquidar va a fallar con el
  // mensaje "No hay escala vigente" hasta que se resuelva. ──
  for (const cat of CATEGORIAS_SIN_ESCALA) {
    const convenioId = convenioIdPorCodigo.get(cat.convenio);
    if (!convenioId) continue;
    const existente = await prisma.categoria.findFirst({ where: { convenioId, nombre: cat.nombre } });
    if (!existente) {
      await prisma.categoria.create({ data: { convenioId, codigo: cat.nombre.slice(0, 20), nombre: cat.nombre } });
      console.log(`⚠ Categoría "${cat.nombre}" creada SIN escala — necesita el valor real antes de poder liquidar.`);
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`Rangos: ${rangos.length} | Conceptos: ${CONCEPTOS_REALES.length} | Categorías: ${datos.categorias.length + CATEGORIAS_SIN_ESCALA.length} | Escalas con valor: ${datos.escalas.length}`);
  console.log("\nPendiente de tu parte: el valor real de escala para \"PEON\" (Madera) — 9 empleados activos la usan.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
