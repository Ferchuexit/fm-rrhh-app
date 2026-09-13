// FM RRHH — prisma/crear-empresa-ieme.ts
//
// Crea una empresa de PRUEBA: IEME (Instituto Ezequiel Martínez Estrada),
// colegio privado ficticio en Benavídez (Tigre, Bs. As.) con jardín de
// infantes, primario y secundario — para practicar liquidaciones bajo el
// convenio de docentes privados (Ley 13.047/47) sin tocar los datos reales
// de Moras/Comercio/Madera.
//
// ⚠️ TODO ES DATO INVENTADO A PROPÓSITO (CUIT, CUILs, básicos, domicilios):
// sirve para probar el motor, NO para liquidar sueldos reales. Los básicos
// son valores de referencia ilustrativos — antes de usar esto en serio hay
// que reemplazarlos por la escala real vigente de la paritaria SADOP/AIEPBA
// (o el convenio propio del colegio, si lo tuviera) y confirmar los
// porcentajes de título/zona/jerárquico contra el CCT correspondiente.
//
// Idempotente: se puede correr más de una vez sin duplicar nada — usa
// findUnique/findFirst por código antes de crear en cada paso, igual que
// crear-convenio-comercio.ts / crear-reglas-comercio.ts.
//
// Uso:
//   npx tsx prisma/crear-empresa-ieme.ts
// Usa el cliente extendido de lib/prisma.ts (no `new PrismaClient()` a
// secas) para que los campos Decimal (Escala.basico, ValorConceptoCategoria.valor,
// etc.) vuelvan como `number` normal al leerlos — igual que en el resto de
// la app — y así la comparación de idempotencia en upsertValorCategoria
// compare number contra number, no Decimal contra number.
import { prisma } from "../lib/prisma";
import { sugerirProximoNumero } from "../lib/motor/catalogo-conceptos.mjs";

const VIGENCIA_DESDE = new Date("2026-01-01");

// ────────────────────────────────────────────────────────────────────────
// Helpers (mismo patrón que crear-antiguedad-presentismo-ausencias-madera.ts)
// ────────────────────────────────────────────────────────────────────────

async function asegurarRangosNumeracion() {
  const existentes = await prisma.rangoNumeracion.findMany();
  if (existentes.length > 0) return; // ya hay rangos configurados — no tocar los del estudio
  await prisma.rangoNumeracion.createMany({
    data: [
      { tipo: "remunerativo", desde: 100, hasta: 1000 },
      { tipo: "no_remunerativo", desde: 1100, hasta: 2000 },
      { tipo: "descuento", desde: 9000, hasta: 15000 },
    ],
  });
  console.log("✔ No había rangos de numeración — se cargaron los rangos por defecto.");
}

async function obtenerOCrearConcepto(opts: {
  codigo: string;
  nombre: string;
  tipo: "remunerativo" | "no_remunerativo" | "descuento";
  categoriaNovedad: string;
}) {
  const existente = await prisma.concepto.findUnique({ where: { codigo: opts.codigo } });
  if (existente) return existente; // ya existe (puede venir de Moras) — se reutiliza tal cual, no se pisa nombre/numero

  const rangos = await prisma.rangoNumeracion.findMany();
  const conceptosExistentes = await prisma.concepto.findMany();
  const numero = sugerirProximoNumero(opts.tipo, rangos, conceptosExistentes as any);

  const creado = await prisma.concepto.create({
    data: {
      codigo: opts.codigo,
      numero,
      nombre: opts.nombre,
      tipo: opts.tipo,
      unidad: "monto",
      categoriaNovedad: opts.categoriaNovedad,
    },
  });
  console.log(`✔ Concepto "${opts.codigo}" creado (número ${numero ?? "sin asignar — ampliar RangoNumeracion"}).`);
  return creado;
}

async function upsertRegla(convenioId: string, conceptoId: string, codigo: string, formula: string, aporta: boolean, contribuye: boolean) {
  const existente = await prisma.reglaConcepto.findFirst({ where: { conceptoId, convenioId, vigenciaHasta: null } });
  if (existente) {
    if (existente.formula === formula && existente.aporta === aporta && existente.contribuye === contribuye) return;
    await prisma.reglaConcepto.update({ where: { id: existente.id }, data: { formula, aporta, contribuye } });
    console.log(`✔ Regla "${codigo}" (IEME/Docentes) actualizada.`);
    return;
  }
  await prisma.reglaConcepto.create({
    data: { conceptoId, convenioId, vigenciaDesde: VIGENCIA_DESDE, formula, aporta, contribuye },
  });
  console.log(`✔ Regla "${codigo}" (IEME/Docentes) creada: ${formula}`);
}

async function upsertValorCategoria(conceptoId: string, categoriaId: string, valor: number) {
  const existente = await prisma.valorConceptoCategoria.findFirst({
    where: { conceptoId, categoriaId, vigenciaDesde: VIGENCIA_DESDE },
  });
  if (existente) {
    if (existente.valor === valor) return;
    await prisma.valorConceptoCategoria.update({ where: { id: existente.id }, data: { valor } });
    return;
  }
  await prisma.valorConceptoCategoria.create({
    data: { conceptoId, categoriaId, vigenciaDesde: VIGENCIA_DESDE, valor },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main() {
  await asegurarRangosNumeracion();

  // ── 1. Empresa ──────────────────────────────────────────────────────
  let empresa = await prisma.empresa.findUnique({ where: { cuit: "30712345678" } });
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: {
        cuit: "30712345678",
        razonSocial: "Instituto Ezequiel Martínez Estrada S.R.L.",
        nombreFantasia: "IEME",
        domicilio: "Av. Presidente Perón 2450, Benavídez, Tigre, Buenos Aires",
      },
    });
    console.log(`✔ Empresa "IEME" creada (${empresa.id}).`);
  } else {
    console.log(`— Empresa "IEME" ya existía (${empresa.id}), se reutiliza.`);
  }

  // ── 2. Convenio: Docentes de Enseñanza Privada (Ley 13.047/47) ──────
  let convenio = await prisma.convenio.findUnique({ where: { codigo: "13047/47" } });
  if (!convenio) {
    convenio = await prisma.convenio.create({
      data: {
        codigo: "13047/47",
        nombre: "Docentes de Enseñanza Privada (Ley 13.047/47)",
        sindicato: "SADOP",
        actividad: "Enseñanza privada — Jardín, Primario y Secundario",
        jurisdiccion: "Buenos Aires",
        vigenciaDesde: VIGENCIA_DESDE,
        fuentesNormativas: "Ley 13.047/47 (Estatuto de la Enseñanza Privada); paritarias SADOP/cámaras empresarias — valores de escala en este script son ILUSTRATIVOS, confirmar contra la última acta paritaria antes de liquidar en serio.",
      },
    });
    console.log(`✔ Convenio "13047/47" (Docentes Privados) creado.`);
  } else {
    console.log(`— Convenio "13047/47" ya existía, se reutiliza.`);
  }

  // ── 3. Categorías — jardín, primario, secundario y directivos ───────
  // MG_ZD es la misma función que MG (Maestro de Grado) pero dictando en
  // la sede-anexo, más alejada del centro — se usa para poder PROBAR el
  // adicional de zona desfavorable con un caso real cargado (ver más abajo).
  const CATEGORIAS = [
    { codigo: "MS", nombre: "Maestro/a de Sala (Jardín de Infantes)", basico: 950000, valorHora: 5900 },
    { codigo: "MG", nombre: "Maestro/a de Grado (Primario)", basico: 980000, valorHora: 6100 },
    { codigo: "MG_ZD", nombre: "Maestro/a de Grado — Sede Anexo (Zona Desfavorable)", basico: 980000, valorHora: 6100 },
    { codigo: "PROFSEC", nombre: "Profesor/a de Secundaria (cargo mensualizado)", basico: 1050000, valorHora: 6550 },
    { codigo: "PRECEP", nombre: "Preceptor/a", basico: 850000, valorHora: 5300 },
    { codigo: "SECDOC", nombre: "Secretario/a Docente", basico: 1100000, valorHora: 6900 },
    { codigo: "DIR", nombre: "Director/a General", basico: 1600000, valorHora: 10000 },
  ];

  const categoriaIdPorCodigo = new Map<string, string>();
  for (const c of CATEGORIAS) {
    let categoria = await prisma.categoria.findFirst({ where: { convenioId: convenio.id, codigo: c.codigo } });
    if (!categoria) {
      categoria = await prisma.categoria.create({ data: { convenioId: convenio.id, codigo: c.codigo, nombre: c.nombre } });
      console.log(`✔ Categoría "${c.codigo}" (${c.nombre}) creada.`);
    }
    categoriaIdPorCodigo.set(c.codigo, categoria.id);

    const escalaExistente = await prisma.escala.findFirst({
      where: { convenioId: convenio.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_DESDE },
    });
    if (!escalaExistente) {
      await prisma.escala.create({
        data: { convenioId: convenio.id, categoriaId: categoria.id, vigenciaDesde: VIGENCIA_DESDE, basico: c.basico, valorHora: c.valorHora },
      });
      console.log(`  ↳ Escala cargada: básico $${c.basico.toLocaleString("es-AR")}.`);
    }
  }

  // ── 4. Conceptos — reutiliza los que ya existan (REM_BASICA, ANTIGUEDAD,
  // PRESENTISMO, JUBILACION, LEY_19032 suelen existir desde Madera/Comercio)
  // y crea los específicos de docentes que falten. ──
  const conceptos = {
    remBasica: await obtenerOCrearConcepto({ codigo: "REM_BASICA", nombre: "Remuneración Básica", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" }),
    antiguedad: await obtenerOCrearConcepto({ codigo: "ANTIGUEDAD", nombre: "Antigüedad", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" }),
    presentismo: await obtenerOCrearConcepto({ codigo: "PRESENTISMO", nombre: "Presentismo", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" }),
    tituloUniversitario: await obtenerOCrearConcepto({ codigo: "TITULO_UNIVERSITARIO", nombre: "Adicional por Título", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" }),
    zonaDesfavorable: await obtenerOCrearConcepto({ codigo: "ZONA_DESFAVORABLE", nombre: "Adicional Zona Desfavorable", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" }),
    adicJerarquico: await obtenerOCrearConcepto({ codigo: "ADIC_JERARQUICO", nombre: "Suplemento por Cargo Jerárquico", tipo: "remunerativo", categoriaNovedad: "Básicos y Fijos" }),
    jubilacion: await obtenerOCrearConcepto({ codigo: "JUBILACION", nombre: "Jubilación", tipo: "descuento", categoriaNovedad: "Otros" }),
    ley19032: await obtenerOCrearConcepto({ codigo: "LEY_19032", nombre: "Ley 19.032 (INSSJP)", tipo: "descuento", categoriaNovedad: "Otros" }),
    obraSocialDocente: await obtenerOCrearConcepto({ codigo: "OBRA_SOCIAL_DOCENTE", nombre: "Obra Social Docente (OSPLAD)", tipo: "descuento", categoriaNovedad: "Otros" }),
    sindicatoSadop: await obtenerOCrearConcepto({ codigo: "SINDICATO_SADOP", nombre: "Cuota Sindical SADOP", tipo: "descuento", categoriaNovedad: "Otros" }),
  };

  // ── 5. Valores por categoría — título, zona desfavorable y jerárquico ──
  // (0 = no aplica para esa categoría; el motor exige que exista la fila
  // igual, aunque sea en 0, porque VALOR_CATEGORIA() no admite "ausente").
  const VALORES_POR_CATEGORIA: Record<string, { titulo: number; zona: number; jerarquico: number }> = {
    MS: { titulo: 0.10, zona: 0, jerarquico: 0 },
    MG: { titulo: 0.10, zona: 0, jerarquico: 0 },
    MG_ZD: { titulo: 0.10, zona: 0.20, jerarquico: 0 }, // ← el caso de prueba de "zona desfavorable"
    PROFSEC: { titulo: 0.15, zona: 0, jerarquico: 0 },
    PRECEP: { titulo: 0, zona: 0, jerarquico: 0 },
    SECDOC: { titulo: 0.15, zona: 0, jerarquico: 0.15 },
    DIR: { titulo: 0.15, zona: 0, jerarquico: 0.30 },
  };

  for (const [codigo, valores] of Object.entries(VALORES_POR_CATEGORIA)) {
    const categoriaId = categoriaIdPorCodigo.get(codigo)!;
    await upsertValorCategoria(conceptos.tituloUniversitario.id, categoriaId, valores.titulo);
    await upsertValorCategoria(conceptos.zonaDesfavorable.id, categoriaId, valores.zona);
    await upsertValorCategoria(conceptos.adicJerarquico.id, categoriaId, valores.jerarquico);
  }
  console.log("✔ Valores por categoría (título / zona desfavorable / jerárquico) cargados.");

  // ── 6. Reglas del convenio (motor de cálculo) ────────────────────────
  // Remuneración base acumulada, para los descuentos — mismo patrón que
  // BASE_REM en crear-reglas-comercio.ts.
  const BASE_REM =
    "(CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD') + CONCEPTO('PRESENTISMO') + CONCEPTO('TITULO_UNIVERSITARIO') + CONCEPTO('ADIC_JERARQUICO') + CONCEPTO('ZONA_DESFAVORABLE'))";

  await upsertRegla(convenio.id, conceptos.remBasica.id, "REM_BASICA", "BASICO", true, true);
  await upsertRegla(convenio.id, conceptos.antiguedad.id, "ANTIGUEDAD", "BASICO * ANTIGUEDAD_ANIOS * 0.01", true, true);
  await upsertRegla(
    convenio.id,
    conceptos.presentismo.id,
    "PRESENTISMO",
    "IF(DIAS_TRABAJADOS >= DIAS_MES, (CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD')) * 0.10, 0)",
    true,
    true
  );
  await upsertRegla(convenio.id, conceptos.tituloUniversitario.id, "TITULO_UNIVERSITARIO", "CONCEPTO('REM_BASICA') * VALOR_CATEGORIA('TITULO_UNIVERSITARIO')", true, true);
  await upsertRegla(convenio.id, conceptos.adicJerarquico.id, "ADIC_JERARQUICO", "CONCEPTO('REM_BASICA') * VALOR_CATEGORIA('ADIC_JERARQUICO')", true, true);
  await upsertRegla(
    convenio.id,
    conceptos.zonaDesfavorable.id,
    "ZONA_DESFAVORABLE",
    "(CONCEPTO('REM_BASICA') + CONCEPTO('ANTIGUEDAD') + CONCEPTO('PRESENTISMO') + CONCEPTO('TITULO_UNIVERSITARIO') + CONCEPTO('ADIC_JERARQUICO')) * VALOR_CATEGORIA('ZONA_DESFAVORABLE')",
    true,
    true
  );
  await upsertRegla(convenio.id, conceptos.jubilacion.id, "JUBILACION", `${BASE_REM} * 0.11`, false, false);
  await upsertRegla(convenio.id, conceptos.ley19032.id, "LEY_19032", `${BASE_REM} * 0.03`, false, false);
  await upsertRegla(convenio.id, conceptos.obraSocialDocente.id, "OBRA_SOCIAL_DOCENTE", `${BASE_REM} * 0.03`, false, false);
  await upsertRegla(convenio.id, conceptos.sindicatoSadop.id, "SINDICATO_SADOP", `${BASE_REM} * 0.02`, false, false);

  // ── 7. Centros de costo y sucursal ───────────────────────────────────
  async function obtenerOCrearCentroCosto(nombre: string) {
    let cc = await prisma.centroCosto.findFirst({ where: { empresaId: empresa!.id, nombre } });
    if (!cc) cc = await prisma.centroCosto.create({ data: { empresaId: empresa!.id, nombre } });
    return cc;
  }
  const centros = {
    jardin: await obtenerOCrearCentroCosto("Jardín de Infantes"),
    primario: await obtenerOCrearCentroCosto("Primario"),
    secundario: await obtenerOCrearCentroCosto("Secundario"),
    direccion: await obtenerOCrearCentroCosto("Dirección y Administración"),
  };

  let sucursal = await prisma.sucursal.findFirst({ where: { empresaId: empresa.id, nombre: "Sede Central" } });
  if (!sucursal) {
    sucursal = await prisma.sucursal.create({
      data: { empresaId: empresa.id, nombre: "Sede Central", direccion: "Av. Presidente Perón 2450, Benavídez" },
    });
  }
  let anexo = await prisma.sucursal.findFirst({ where: { empresaId: empresa.id, nombre: "Sede Anexo" } });
  if (!anexo) {
    anexo = await prisma.sucursal.create({
      data: { empresaId: empresa.id, nombre: "Sede Anexo", direccion: "Camino de la Ribera s/n, Benavídez (zona desfavorable)" },
    });
  }

  // ── 8. 7 legajos ficticios, uno por categoría ────────────────────────
  const legajosData = [
    {
      numeroLegajo: 1, cuil: "27352221115", apellido: "Sosa", nombre: "María Belén", fechaIngreso: "2023-03-01",
      categoria: "MS", centroCosto: centros.jardin.id, sucursal: sucursal.id,
      domicilio: "Ruta 25 km 3, Benavídez", localidad: "Benavídez", provincia: "Buenos Aires", partido: "Tigre",
    },
    {
      numeroLegajo: 2, cuil: "27305567774", apellido: "Ibarra", nombre: "Lucía Fernanda", fechaIngreso: "2019-03-01",
      categoria: "MG", centroCosto: centros.primario.id, sucursal: sucursal.id,
      domicilio: "Calle Sarmiento 845, Benavídez", localidad: "Benavídez", provincia: "Buenos Aires", partido: "Tigre",
    },
    {
      numeroLegajo: 3, cuil: "20334445553", apellido: "Correa", nombre: "Martín Ezequiel", fechaIngreso: "2025-03-01",
      categoria: "MG_ZD", centroCosto: centros.primario.id, sucursal: anexo.id,
      domicilio: "Los Ceibos 210, Benavídez", localidad: "Benavídez", provincia: "Buenos Aires", partido: "Tigre",
    },
    {
      numeroLegajo: 4, cuil: "27367778882", apellido: "Paredes", nombre: "Rocío Anahí", fechaIngreso: "2022-03-01",
      categoria: "PROFSEC", centroCosto: centros.secundario.id, sucursal: sucursal.id,
      domicilio: "Av. Rivadavia 1230, Benavídez", localidad: "Benavídez", provincia: "Buenos Aires", partido: "Tigre",
    },
    {
      numeroLegajo: 5, cuil: "20381112223", apellido: "Rivas", nombre: "Diego Alejandro", fechaIngreso: "2024-03-01",
      categoria: "PRECEP", centroCosto: centros.secundario.id, sucursal: sucursal.id,
      domicilio: "Belgrano 560, Benavídez", localidad: "Benavídez", provincia: "Buenos Aires", partido: "Tigre",
    },
    {
      numeroLegajo: 6, cuil: "27289991114", apellido: "Aguirre", nombre: "Gabriela Soledad", fechaIngreso: "2016-03-01",
      categoria: "SECDOC", centroCosto: centros.direccion.id, sucursal: sucursal.id,
      domicilio: "San Martín 990, Benavídez", localidad: "Benavídez", provincia: "Buenos Aires", partido: "Tigre",
    },
    {
      numeroLegajo: 7, cuil: "20223334445", apellido: "Molina", nombre: "Ricardo Alberto", fechaIngreso: "2011-03-01",
      categoria: "DIR", centroCosto: centros.direccion.id, sucursal: sucursal.id,
      domicilio: "Mitre 1455, Benavídez", localidad: "Benavídez", provincia: "Buenos Aires", partido: "Tigre",
    },
  ];

  let legajosCreados = 0;
  for (const l of legajosData) {
    const existente = await prisma.legajo.findFirst({ where: { empresaId: empresa.id, numeroLegajo: l.numeroLegajo } });
    if (existente) {
      console.log(`— Legajo ${l.numeroLegajo} (${l.apellido}) ya existía, se salta.`);
      continue;
    }
    await prisma.legajo.create({
      data: {
        empresaId: empresa.id,
        numeroLegajo: l.numeroLegajo,
        cuil: l.cuil,
        apellido: l.apellido,
        nombre: l.nombre,
        fechaIngreso: new Date(l.fechaIngreso),
        convenioId: convenio.id,
        categoriaId: categoriaIdPorCodigo.get(l.categoria)!,
        obraSocialId: "OSPLAD",
        cbu: `0070999530000012345${String(l.numeroLegajo).padStart(3, "0")}`,
        bancoId: "Banco Galicia",
        centroCostoId: l.centroCosto,
        sucursalId: l.sucursal,
        tipoDocumento: "DNI",
        numeroDocumento: l.cuil.slice(2, 10),
        modalidadContrato: "Tiempo completo",
        artNombre: "Federación Patronal ART S.A.",
        domicilio: l.domicilio,
        localidad: l.localidad,
        provincia: l.provincia,
        partido: l.partido,
      },
    });
    legajosCreados++;
  }
  console.log(`✔ ${legajosCreados} legajos nuevos creados (de ${legajosData.length} definidos).`);

  // ── 9. Un período en borrador, para poder liquidar de una vez ───────
  let periodo = await prisma.periodo.findFirst({ where: { empresaId: empresa.id, nombre: "Marzo 2026" } });
  if (!periodo) {
    periodo = await prisma.periodo.create({
      data: {
        empresaId: empresa.id,
        convenioId: convenio.id,
        nombre: "Marzo 2026",
        fechaDesde: new Date("2026-03-01"),
        fechaHasta: new Date("2026-03-31"),
        estado: "borrador",
      },
    });
    console.log(`✔ Período "Marzo 2026" creado en borrador.`);
  }

  console.log("\n──────────────────────────────────────────────");
  console.log("IEME listo para practicar liquidaciones:");
  console.log(`  Empresa:  ${empresa.nombreFantasia} (${empresa.id})`);
  console.log(`  Convenio: ${convenio.nombre} (${convenio.id})`);
  console.log(`  Categorías: ${CATEGORIAS.map((c) => c.codigo).join(", ")}`);
  console.log(`  Legajos: ${legajosData.map((l) => `${l.numeroLegajo} (${l.categoria})`).join(", ")}`);
  console.log('  Probá el legajo 3 (Correa, MG_ZD) para ver el adicional "Zona Desfavorable" en acción.');
  console.log("──────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
