// FM RRHH — app/api/legajos/route.ts
// GET: tres modos —
//   ?periodoId=X       → listado liviano para selects atados a un período (novedades)
//   ?proximoNumero=1   → solo el próximo número de legajo libre, para precargar el alta
//   (sin parámetros)   → listado liviano de todos los activos, para pantallas sin período (vacaciones)
// POST: crea un legajo nuevo, con todas las secciones de la ficha ampliada.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get("periodoId");
    const proximoNumero = searchParams.get("proximoNumero");

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

    if (proximoNumero) {
      const ultimo = await prisma.legajo.findFirst({ where: { empresaId: empresa.id }, orderBy: { numeroLegajo: "desc" } });
      return NextResponse.json({ proximoNumero: (ultimo?.numeroLegajo ?? 0) + 1 });
    }

    const empresaIdFiltro = periodoId ? (await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } })).empresaId : empresa.id;
    const legajos = await prisma.legajo.findMany({
      where: { empresaId: empresaIdFiltro, condicion: "activo" },
      orderBy: { numeroLegajo: "asc" },
    });

    return NextResponse.json(legajos.map((l) => ({ id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre })));
  } catch (e: any) {
    // Red de seguridad que esta ruta no tenía — un periodoId inválido (por
    // ejemplo, texto escrito a mano en vez de pegado desde el sistema)
    // tiraba un error sin control, y el cliente recibía una respuesta
    // vacía en vez de JSON ("Unexpected end of JSON input").
    console.error("Error en GET /api/legajos:", e);
    return NextResponse.json({ error: e.message ?? "No se pudieron cargar los legajos — ¿el periodoId es válido?" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

  if (!body.numeroLegajo || !body.cuil || !body.apellido || !body.nombre || !body.fechaIngreso || !body.convenioId || !body.categoriaId) {
    return NextResponse.json({ error: "Faltan campos obligatorios (legajo, CUIL, apellido, nombre, fecha de ingreso, convenio, categoría)." }, { status: 400 });
  }

  try {
    const legajo = await prisma.legajo.create({
      data: {
        empresaId: empresa.id,
        numeroLegajo: Number(body.numeroLegajo),
        cuil: body.cuil,
        apellido: body.apellido,
        nombre: body.nombre,
        fechaIngreso: new Date(body.fechaIngreso),
        convenioId: body.convenioId,
        categoriaId: body.categoriaId,
        obraSocialId: body.obraSocialId || null,
        cbu: body.cbu || null,
        bancoId: body.bancoId || null,
        tipoDocumento: body.tipoDocumento || null,
        numeroDocumento: body.numeroDocumento || null,
        fechaNacimiento: body.fechaNacimiento ? new Date(body.fechaNacimiento) : null,
        sexo: body.sexo || null,
        estadoCivil: body.estadoCivil || null,
        nivelEducativo: body.nivelEducativo || null,
        tituloObtenido: body.tituloObtenido || null,
        talleRopa: body.talleRopa || null,
        talleCalzado: body.talleCalzado || null,
        domicilio: body.domicilio || null,
        localidad: body.localidad || null,
        provincia: body.provincia || null,
        partido: body.partido || null,
        telefono: body.telefono || null,
        email: body.email || null,
        fotoBase64: body.fotoBase64 || null,
        centroCostoId: body.centroCostoId || null,
        sucursalId: body.sucursalId || null,
        afiliadoSindicato: body.afiliadoSindicato !== undefined ? Boolean(body.afiliadoSindicato) : true,
        antiguedadReconocida: body.antiguedadReconocida ? new Date(body.antiguedadReconocida) : null,
        modalidadContrato: body.modalidadContrato || null,
        codigoArcaModalidad: body.codigoArcaModalidad || null,
        artNombre: body.artNombre || null,
        artPoliza: body.artPoliza || null,
      },
    });
    return NextResponse.json(legajo);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: `Ya existe un legajo número ${body.numeroLegajo} en esta empresa.` }, { status: 409 });
    }
    throw e;
  }
}
