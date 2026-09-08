// FM RRHH — prisma/seed.ts (v2 — seed completo)
// Reemplaza al seed anterior. Pensado para poder probar liquidación,
// novedades, auditoría y exportación LSD/F.931 de punta a punta sin tener
// que ir cargando datos a mano desde las pantallas. Todos los legajos acá
// están completos a propósito (CBU, obra social, banco) — si querés volver
// a probar el semáforo de auditoría en rojo, editá un legajo y borrale un
// dato desde /legajos (todavía no hay edición ahí — próximo paso del plan).
//
// ⚠️ Esto reemplaza los datos existentes. Antes de correr:
//   rm prisma/dev.db
//   npx prisma migrate dev --name seed_completo   (recrea todo y corre este seed solo)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Usuario para poder loguearse — contraseña de ejemplo, cambiarla en /usuarios
  // cuando exista esa pantalla (todavía no existe, ver 28-login.md). ──
  await prisma.usuario.create({
    data: {
      email: "fernando@fmconsultora.com",
      nombre: "Fernando Martínez",
      passwordHash: await bcrypt.hash("cambiar123", 10),
      rol: "admin",
    },
  });

  const empresa = await prisma.empresa.create({
    data: { cuit: "30645234061", razonSocial: "Diseños y Aberturas Moras S.A.", nombreFantasia: "Moras" },
  });

  const convenio = await prisma.convenio.create({ data: { codigo: "0335/75", nombre: "Madera y Afines (USIMRA — CCT 335/75)" } });
  await prisma.convenio.create({ data: { codigo: "9999/99", nombre: "Excluido de Convenio (Directores / fuera de convenio)" } });

  const categorias = {
    oficial: await prisma.categoria.create({ data: { convenioId: convenio.id, codigo: "OF", nombre: "Oficial" } }),
    medioOficial: await prisma.categoria.create({ data: { convenioId: convenio.id, codigo: "MO", nombre: "Medio Oficial" } }),
    ayudante: await prisma.categoria.create({ data: { convenioId: convenio.id, codigo: "AY", nombre: "Ayudante" } }),
    administrativo: await prisma.categoria.create({ data: { convenioId: convenio.id, codigo: "AD", nombre: "Administrativo" } }),
  };

  const vigenciaEscalas = new Date("2026-01-01");
  await prisma.escala.createMany({
    data: [
      { convenioId: convenio.id, categoriaId: categorias.oficial.id, vigenciaDesde: vigenciaEscalas, basico: 850000, valorHora: 4500 },
      { convenioId: convenio.id, categoriaId: categorias.medioOficial.id, vigenciaDesde: vigenciaEscalas, basico: 720000, valorHora: 3800 },
      { convenioId: convenio.id, categoriaId: categorias.ayudante.id, vigenciaDesde: vigenciaEscalas, basico: 620000, valorHora: 3300 },
      { convenioId: convenio.id, categoriaId: categorias.administrativo.id, vigenciaDesde: vigenciaEscalas, basico: 700000, valorHora: 3700 },
    ],
  });

  // ── Rango de numeración de conceptos (configurable — estos son de ejemplo) ──
  await prisma.rangoNumeracion.createMany({
    data: [
      { tipo: "remunerativo", desde: 100, hasta: 1000 },
      { tipo: "no_remunerativo", desde: 1100, hasta: 2000 },
      { tipo: "descuento", desde: 9000, hasta: 15000 },
    ],
  });

  // ── Conceptos, ya con número asignado (antes había que asignarlo a mano en /conceptos) ──
  const remBasica = await prisma.concepto.create({ data: { codigo: "REM_BASICA", numero: 100, nombre: "Remuneración Básica", tipo: "remunerativo", unidad: "monto", categoriaNovedad: "Básicos y Fijos" } });
  const antiguedad = await prisma.concepto.create({ data: { codigo: "ANTIGUEDAD", numero: 101, nombre: "Antigüedad", tipo: "remunerativo", unidad: "monto", categoriaNovedad: "Básicos y Fijos" } });
  const presentismo = await prisma.concepto.create({ data: { codigo: "PRESENTISMO", numero: 102, nombre: "Presentismo", tipo: "remunerativo", unidad: "monto", categoriaNovedad: "Básicos y Fijos" } });
  await prisma.concepto.create({ data: { codigo: "HS_EXTRA_50", numero: 103, nombre: "Horas Extra 50%", tipo: "remunerativo", unidad: "horas", categoriaNovedad: "Horas" } });
  await prisma.concepto.create({ data: { codigo: "HS_EXTRA_100", numero: 104, nombre: "Horas Extra 100%", tipo: "remunerativo", unidad: "horas", categoriaNovedad: "Horas" } });
  await prisma.concepto.create({ data: { codigo: "PREMIO", numero: 105, nombre: "Premio", tipo: "remunerativo", unidad: "monto", categoriaNovedad: "Premios y Comisiones" } });
  await prisma.concepto.create({ data: { codigo: "INCREMENTO_NR", numero: 1100, nombre: "Incremento No Remunerativo", tipo: "no_remunerativo", unidad: "monto", categoriaNovedad: "Básicos y Fijos" } });
  await prisma.concepto.create({ data: { codigo: "ENFERMEDAD", numero: 1101, nombre: "Enfermedad", tipo: "no_remunerativo", unidad: "horas", categoriaNovedad: "Licencias y Ausencias" } });
  await prisma.concepto.create({ data: { codigo: "ADELANTO", numero: 9000, nombre: "Adelanto de Sueldo", tipo: "descuento", unidad: "monto", categoriaNovedad: "Préstamos y Adelantos" } });

  // ── Reglas (motor de cálculo) ──
  await prisma.reglaConcepto.create({
    // Madera (0335/75) liquida por hora en la realidad — ver 32-calculo-por-hora.md.
    // BASICO (el fijo mensual) queda sin usar acá, pero se sigue calculando
    // en varsBase por si algún concepto de otro convenio lo necesita.
    data: { conceptoId: remBasica.id, convenioId: convenio.id, vigenciaDesde: vigenciaEscalas, formula: "VALOR_HORA * HORAS_TRABAJADAS", aporta: true, contribuye: true },
  });
  await prisma.reglaConcepto.create({
    data: { conceptoId: antiguedad.id, convenioId: convenio.id, vigenciaDesde: vigenciaEscalas, formula: "CONCEPTO('REM_BASICA') * 0.01 * ANTIGUEDAD_ANIOS", aporta: true, contribuye: true },
  });
  await prisma.reglaConcepto.create({
    data: { conceptoId: presentismo.id, convenioId: convenio.id, vigenciaDesde: vigenciaEscalas, formula: "IF(DIAS_TRABAJADOS >= DIAS_MES, CONCEPTO('REM_BASICA') * 0.08, 0)", aporta: true, contribuye: true },
  });

  // ── Parámetros y topes — acá estaban solo el jubilatorio antes. Se agregan
  // las 5 tasas que /api/exportar/f931 usaba hardcodeadas, para que ahora
  // las lea de acá (ver route.ts actualizado). ──
  await prisma.parametroVigente.createMany({
    data: [
      { clave: "TOPE_JUBILATORIO", valor: 1200000, vigenciaDesde: vigenciaEscalas, fuente: "Valor de referencia — confirmar contra la resolución vigente real" },
      { clave: "TOPE_OBRA_SOCIAL", valor: 950000, vigenciaDesde: vigenciaEscalas, fuente: "Valor de referencia" },
      { clave: "APORTE_JUBILACION", valor: 0.11, vigenciaDesde: vigenciaEscalas, fuente: "Tasa estándar de referencia" },
      { clave: "APORTE_LEY19032", valor: 0.03, vigenciaDesde: vigenciaEscalas, fuente: "Tasa estándar de referencia" },
      { clave: "APORTE_OBRA_SOCIAL", valor: 0.03, vigenciaDesde: vigenciaEscalas, fuente: "Tasa estándar de referencia" },
      { clave: "CONTRIB_SIPA", valor: 0.18, vigenciaDesde: vigenciaEscalas, fuente: "Tasa estándar de referencia" },
      { clave: "CONTRIB_OBRA_SOCIAL", valor: 0.06, vigenciaDesde: vigenciaEscalas, fuente: "Tasa estándar de referencia" },
    ],
  });

  // ── Legajos — todos completos a propósito (CBU, obra social, banco) ──
  const centros = {
    taller: await prisma.centroCosto.create({ data: { empresaId: empresa.id, nombre: "Taller" } }),
    administracion: await prisma.centroCosto.create({ data: { empresaId: empresa.id, nombre: "Administración" } }),
    ventas: await prisma.centroCosto.create({ data: { empresaId: empresa.id, nombre: "Ventas" } }),
  };

  const legajosData = [
    { numeroLegajo: 4, cuil: "20171871817", apellido: "Retamar", nombre: "Julián", fechaIngreso: "2020-04-12", categoriaId: categorias.oficial.id, cbu: "0170099220000006426229", centroCostoId: centros.taller.id },
    { numeroLegajo: 7, cuil: "27340621412", apellido: "Bassi", nombre: "Carla", fechaIngreso: "2022-02-03", categoriaId: categorias.administrativo.id, cbu: "0170099220000006426230", centroCostoId: centros.administracion.id },
    { numeroLegajo: 12, cuil: "27298841202", apellido: "Ferreyra", nombre: "Sol", fechaIngreso: "2021-06-15", categoriaId: categorias.medioOficial.id, cbu: "0170099220000006426231", centroCostoId: centros.ventas.id },
    { numeroLegajo: 15, cuil: "20394576663", apellido: "Duarte", nombre: "Pablo", fechaIngreso: "2019-01-10", categoriaId: categorias.ayudante.id, cbu: "0170099220000006426232", centroCostoId: centros.taller.id },
    { numeroLegajo: 20, cuil: "27340621293", apellido: "Coria", nombre: "Lucas", fechaIngreso: "2023-09-01", categoriaId: categorias.oficial.id, cbu: "0170099220000006426233", centroCostoId: centros.taller.id },
  ];

  for (const l of legajosData) {
    await prisma.legajo.create({
      data: {
        empresaId: empresa.id,
        numeroLegajo: l.numeroLegajo,
        cuil: l.cuil,
        apellido: l.apellido,
        nombre: l.nombre,
        fechaIngreso: new Date(l.fechaIngreso),
        convenioId: convenio.id,
        categoriaId: l.categoriaId,
        obraSocialId: "OSDELPI",
        cbu: l.cbu,
        bancoId: "HSBC",
        centroCostoId: l.centroCostoId,
        tipoDocumento: "DNI",
        modalidadContrato: "Tiempo completo",
        artNombre: "Provincia ART S.A.",
      },
    });
  }

  const periodo = await prisma.periodo.create({
    data: {
      empresaId: empresa.id,
      nombre: "Julio 2026",
      fechaDesde: new Date("2026-07-01"),
      fechaHasta: new Date("2026-07-31"),
      estado: "borrador",
    },
  });

  console.log("Seed completo cargado:");
  console.log({ empresaId: empresa.id, periodoId: periodo.id, legajos: legajosData.map((l) => l.numeroLegajo) });
  console.log("\n5 legajos, 4 categorías, 9 conceptos (todos numerados), 3 reglas, 7 parámetros vigentes.");
  console.log("\nLogin: fernando@fmconsultora.com / cambiar123");
  console.log("Abrí http://localhost:3000/login para entrar.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
