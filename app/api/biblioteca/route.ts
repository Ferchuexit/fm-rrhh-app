// FM RRHH — app/api/biblioteca/route.ts
// La Librería de conocimiento vista por RR.HH.: todos los artículos con
// cuánta gente los abrió, y crear o editar uno (formulario con archivo).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { CAMPOS_LISTA, CATEGORIAS_SUGERIDAS, prepararArchivo, validarArticulo } from "@/lib/biblioteca";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [articulos, sectores, legajos] = await Promise.all([
      prisma.articuloBiblioteca.findMany({ where: { empresaId: empresa.id }, select: { ...CAMPOS_LISTA, _count: { select: { lecturas: true } } }, orderBy: [{ categoria: "asc" }, { titulo: "asc" }] }),
      prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { centroCostoId: true } }),
    ]);
    // A cuántos les corresponde cada artículo: para leer "lo abrieron 12 de 40".
    const destinatarios = (ids: string[]) => (ids.length === 0 ? legajos.length : legajos.filter((l) => l.centroCostoId && ids.includes(l.centroCostoId)).length);
    return NextResponse.json({ sectores, sugeridas: CATEGORIAS_SUGERIDAS, articulos: articulos.map(({ _count, ...a }) => ({ ...a, lecturas: _count.lecturas, destinatarios: destinatarios(a.centroCostoIds) })) });
  } catch (e: any) {
    console.error("Error en GET /api/biblioteca:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para la Librería. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudo cargar la librería. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "No llegó el formulario. Si el archivo pesa más de 4 MB, probá con uno más liviano." }, { status: 400 });
    const id = String(form.get("id") ?? "");
    const antes = id ? await prisma.articuloBiblioteca.findFirst({ where: { id, empresaId: empresa.id }, select: { id: true, contenido: true, enlace: true, archivoKey: true, archivoBase64: true } }) : null;
    if (id && !antes) return NextResponse.json({ error: "No se encontró ese artículo." }, { status: 404 });

    const subido = form.get("archivo") instanceof File && (form.get("archivo") as File).size > 0 ? (form.get("archivo") as File) : null;
    const quitar = form.get("quitarArchivo") === "true";
    const queda = !!subido || (!quitar && !!antes && !!(antes.archivoKey || antes.archivoBase64));
    const { datos, error } = validarArticulo(Object.fromEntries(form), queda);
    if (!datos) return NextResponse.json({ error }, { status: 400 });
    const validos = await prisma.centroCosto.count({ where: { id: { in: datos.centroCostoIds }, empresaId: empresa.id } });
    if (validos !== datos.centroCostoIds.length) return NextResponse.json({ error: "Alguno de los sectores ya no existe. Recargá la página." }, { status: 400 });
    const archivo = await prepararArchivo(subido, empresa.id);
    if (archivo && "error" in archivo) return NextResponse.json({ error: archivo.error }, { status: 400 });
    const delArchivo = archivo ?? (quitar ? { archivoNombre: null, archivoKey: null, archivoBase64: null, archivoMime: null, archivoTexto: null } : {});

    if (!antes) {
      const a = await prisma.articuloBiblioteca.create({ data: { ...datos, ...delArchivo, empresaId: empresa.id, creadoPor: sesion.email } });
      return NextResponse.json({ ok: true, id: a.id });
    }
    // "Actualizado el…" cambia solo si cambió lo que se lee.
    const cambio = !!archivo || quitar || antes.contenido !== datos.contenido || antes.enlace !== datos.enlace;
    await prisma.articuloBiblioteca.update({ where: { id: antes.id }, data: { ...datos, ...delArchivo, ...(cambio ? { actualizadoEn: new Date() } : {}) } });
    return NextResponse.json({ ok: true, id: antes.id });
  } catch (e: any) {
    console.error("Error en POST /api/biblioteca:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? "La librería la carga RR.HH." : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
