// FM RRHH — app/api/reclutamiento/[id]/route.ts
// Una búsqueda con sus candidatos.
//   abrir     → queda publicada (página de empleos y/o portal); si es
//               interna, se avisa a los empleados
//   pausar / reanudar → deja de recibir postulaciones sin cerrarse
//   cerrar    → cubierta o cancelada
//   candidato → RR.HH. carga a mano a alguien (un CV en papel, un referido)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { CAMPOS_CANDIDATO, FUENTES, resumenBusqueda, validarPostulacion, prepararCV, registrarPostulacion } from "@/lib/reclutamiento";
import { avisar, avisoBusquedaInterna, urlBaseDelPedido } from "@/lib/avisos";

export const dynamic = "force-dynamic";
const fallo = (e: any, donde: string) => {
  console.error(`Error en ${donde}:`, e);
  return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? "Las búsquedas las maneja RR.HH." : "No se pudo completar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const busqueda = await prisma.busqueda.findFirst({ where: { id: params.id, empresaId: empresa.id }, include: { puesto: { select: { nombre: true } } } });
    if (!busqueda) return NextResponse.json({ error: "No se encontró esa búsqueda." }, { status: 404 });
    const candidatos = await prisma.candidato.findMany({ where: { busquedaId: busqueda.id }, select: CAMPOS_CANDIDATO, orderBy: [{ puntaje: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }] });
    return NextResponse.json({ busqueda, candidatos, resumen: resumenBusqueda(busqueda, candidatos, hoyArgentina()), enlace: `${urlBaseDelPedido()}/empleos/${busqueda.id}`, empresa: empresa.nombreFantasia || empresa.razonSocial });
  } catch (e) {
    return fallo(e, "GET /api/reclutamiento/[id]");
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const busqueda = await prisma.busqueda.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!busqueda) return NextResponse.json({ error: "No se encontró esa búsqueda." }, { status: 404 });

    // La carga manual puede traer un CV: llega como formulario, no JSON.
    const tipo = req.headers.get("content-type") ?? "";
    if (tipo.includes("multipart/form-data")) {
      const form = await req.formData();
      if (busqueda.estado === "cerrada") return NextResponse.json({ error: "Esa búsqueda está cerrada." }, { status: 409 });
      const { datos, error } = validarPostulacion(Object.fromEntries(form), false);
      if (error) return NextResponse.json({ error }, { status: 400 });
      const fuente = String(form.get("fuente") ?? "manual");
      const cv = await prepararCV(form.get("cv") instanceof File ? (form.get("cv") as File) : null, busqueda.id);
      if ("error" in cv) return NextResponse.json({ error: cv.error }, { status: 400 });
      const r = await registrarPostulacion(prisma, busqueda.id, datos, { fuente: fuente in FUENTES ? fuente : "manual", cv });
      if (r === "repetida") return NextResponse.json({ error: "Ya hay un candidato con ese mail o teléfono en esta búsqueda." }, { status: 409 });
      if (r === "llena") return NextResponse.json({ error: "Esta búsqueda ya tiene demasiados candidatos." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    const body = await req.json().catch(() => ({}));
    const cambiar = async (de: string[], data: Record<string, unknown>, siNo: string) => {
      const { count } = await prisma.busqueda.updateMany({ where: { id: busqueda.id, estado: { in: de } }, data });
      return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: siNo }, { status: 409 });
    };
    if (body.accion === "abrir") {
      const r = await cambiar(["borrador"], { estado: "abierta", abiertaEn: new Date() }, "Esa búsqueda ya estaba abierta.");
      if (r.status === 200 && busqueda.interna) {
        const empleados = await prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true } });
        await avisar(empleados.map((l) => l.id), avisoBusquedaInterna(busqueda.titulo));
      }
      return r;
    }
    if (body.accion === "pausar") return cambiar(["abierta"], { estado: "pausada" }, "Esa búsqueda no está abierta.");
    if (body.accion === "reanudar") return cambiar(["pausada"], { estado: "abierta" }, "Esa búsqueda no está pausada.");
    if (body.accion === "cerrar") {
      const motivo = body.motivo === "cancelada" ? "cancelada" : "cubierta";
      return cambiar(["abierta", "pausada"], { estado: "cerrada", motivoCierre: motivo, cerradaEn: new Date() }, "Esa búsqueda ya estaba cerrada.");
    }
    if (body.accion === "borrar") {
      // Solo un borrador sin candidatos: lo demás es historia.
      if (busqueda.estado !== "borrador" || (await prisma.candidato.count({ where: { busquedaId: busqueda.id } })) > 0) return NextResponse.json({ error: "Solo se puede borrar un borrador sin candidatos. Si ya no corre, cerrala como cancelada." }, { status: 409 });
      await prisma.busqueda.delete({ where: { id: busqueda.id } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (e) {
    return fallo(e, "POST /api/reclutamiento/[id]");
  }
}
