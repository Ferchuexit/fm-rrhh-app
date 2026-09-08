// FM RRHH — prisma/import-empleados-reales.ts
// Paso 4 del plan de datos reales. Carga los 125 empleados reales de
// Diseños y Aberturas Moras S.A. (75 activos, 50 de baja) — legajo 500
// (SILVESTRI, Carlos Daniel) quedó afuera por datos incompletos en el
// origen (sin convenio, sin categoría, sin fecha de ingreso).
//
// No destructivo — usa upsert por (empresa, numeroLegajo), se puede correr
// más de una vez sin duplicar. Corré prisma/eliminar-legajos-prueba.ts ANTES
// de esto, si todavía tenés los legajos ficticios de las pruebas cargados
// (el legajo 4 real choca en número con el "Retamar" de prueba).
import { PrismaClient } from "@prisma/client";
import empleados from "./datos-reales-empleados.json";

const prisma = new PrismaClient();

function separarApellidoNombre(apellidoNombre: string): { apellido: string; nombre: string } {
  const partes = apellidoNombre.split(",");
  if (partes.length < 2) return { apellido: apellidoNombre.trim(), nombre: "" };
  return { apellido: partes[0].trim(), nombre: partes.slice(1).join(",").trim() };
}

async function main() {
  const empresa = await prisma.empresa.findFirst();
  if (!empresa) { console.log("No hay ninguna empresa cargada — andá a /empresas primero."); return; }

  const convenios = await prisma.convenio.findMany();
  const convenioIdPorCodigo = new Map(convenios.map((c) => [c.codigo, c.id]));

  const categorias = await prisma.categoria.findMany();
  const categoriaIdPorClave = new Map(categorias.map((c) => [`${c.convenioId}|${c.nombre}`, c.id]));

  let creados = 0, actualizados = 0, saltados = 0;
  const erroresCategoria: string[] = [];

  for (const e of empleados as any[]) {
    const convenioId = convenioIdPorCodigo.get(e.convenio);
    if (!convenioId) { erroresCategoria.push(`Legajo ${e.numeroLegajo}: convenio "${e.convenio}" no existe.`); saltados++; continue; }

    const categoriaId = categoriaIdPorClave.get(`${convenioId}|${e.categoria}`);
    if (!categoriaId) { erroresCategoria.push(`Legajo ${e.numeroLegajo}: categoría "${e.categoria}" no existe para ese convenio.`); saltados++; continue; }

    if (!e.cuil) {
      erroresCategoria.push(`Legajo ${e.numeroLegajo} (${e.apellidoNombre}): sin CUIL en el origen — no se carga sin inventar uno.`);
      saltados++;
      continue;
    }

    const { apellido, nombre } = separarApellidoNombre(e.apellidoNombre);

    const data = {
      empresaId: empresa.id,
      numeroLegajo: e.numeroLegajo,
      cuil: e.cuil,
      apellido,
      nombre,
      fechaIngreso: new Date(e.fechaIngreso),
      fechaEgreso: e.fechaEgreso ? new Date(e.fechaEgreso) : null,
      convenioId,
      categoriaId,
      condicion: e.condicion,
      obraSocialId: e.obraSocialNombre || null,
      bancoId: e.bancoNombre || null,
      cbu: e.cbu || null,
      domicilio: e.domicilio || null,
      fechaNacimiento: e.fechaNacimiento ? new Date(e.fechaNacimiento) : null,
      tipoDocumento: "DNI",
      // ART: tu catálogo (1.3_ART) marca esto como "PENDIENTE — no informado
      // por el usuario" a nivel empresa, no por persona. Se deja el nombre de
      // la aseguradora de referencia (Provincia ART S.A.), no verificado
      // individualmente — ver 36-empleados-reales.md.
      artNombre: "Provincia ART S.A. (referencia — no verificado por empleado)",
    };

    const existente = await prisma.legajo.findFirst({ where: { empresaId: empresa.id, numeroLegajo: e.numeroLegajo } });
    if (existente) {
      await prisma.legajo.update({ where: { id: existente.id }, data });
      actualizados++;
    } else {
      await prisma.legajo.create({ data });
      creados++;
    }
  }

  console.log(`✔ ${creados} legajos creados, ${actualizados} actualizados, ${saltados} saltados por error.`);
  if (erroresCategoria.length) {
    console.log("\nErrores:");
    erroresCategoria.forEach((e) => console.log(" -", e));
  }

  const activos = (empleados as any[]).filter((e) => e.condicion === "activo").length;
  console.log(`\nDe los ${(empleados as any[]).length} importados: ${activos} activos, ${(empleados as any[]).length - activos} de baja.`);
  console.log("Legajo 500 (SILVESTRI, Carlos Daniel) no se incluyó — datos incompletos en el origen (ver 36-empleados-reales.md).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
