// FM RRHH — app/api/noticias/route.ts
// Lado RR.HH.: publicar una noticia y ver todas las de la empresa actual,
// con cuánta gente la leyó.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { validarNoticia, estadisticas } from "@/lib/noticias";
import { guardarEnCarpeta, bufferDesdeBase64, mimeReal } from "@/lib/almacen-documentos";
import { TAMANIO_MAXIMO_BYTES } from "@/lib/legajo-digital-reglas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ noticias: [] });

    const [noticias, activos] = await Promise.all([
      prisma.noticia.findMany({
        where: { empresaId: empresa.id },
        select: {
          id: true, titulo: true, cuerpo: true, requiereAcuse: true, estado: true, publicadaEn: true, publicadaPor: true, adjuntoNombre: true, centroCostoId: true,
          centroCosto: { select: { nombre: true } }, lecturas: { select: { legajoId: true, acuseEn: true } },
        },
        orderBy: { publicadaEn: "desc" },
        take: 200,
      }),
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, centroCostoId: true } }),
    ]);

    return NextResponse.json({
      noticias: noticias.map(({ lecturas, ...n }) => ({
        ...n,
        ...estadisticas(activos.filter((l) => n.centroCostoId === null || l.centroCostoId === n.centroCostoId).map((l) => l.id), lecturas),
      })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/noticias:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022" || /does not exist|Cannot read properties of undefined/i.test(String(e?.message));
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Noticias. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : `No se pudieron cargar las noticias: ${e?.message ?? "error inesperado"}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const error = validarNoticia(body.titulo, body.cuerpo);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // El sector tiene que ser de ESTA empresa.
    let centroCostoId: string | null = null;
    if (body.centroCostoId) {
      const centro = await prisma.centroCosto.findFirst({ where: { id: String(body.centroCostoId), empresaId: empresa.id }, select: { id: true } });
      if (!centro) return NextResponse.json({ error: "Ese sector no existe en la empresa actual." }, { status: 400 });
      centroCostoId = centro.id;
    }

    let adjunto = {};
    if (body.adjuntoBase64) {
      const buffer = bufferDesdeBase64(body.adjuntoBase64);
      if (!buffer) return NextResponse.json({ error: "No se pudo leer el adjunto." }, { status: 400 });
      if (buffer.length > TAMANIO_MAXIMO_BYTES) return NextResponse.json({ error: "El adjunto pesa más de 3 MB — comprimilo o usá una imagen más chica." }, { status: 413 });
      const mime = mimeReal(buffer);
      if (!mime) return NextResponse.json({ error: "El adjunto tiene que ser una imagen (JPG, PNG) o un PDF." }, { status: 400 });
      const nombre = String(body.adjuntoNombre ?? "adjunto").slice(0, 100);
      const guardado = await guardarEnCarpeta(`noticias/${empresa.id}`, nombre, buffer, mime);
      adjunto = { adjuntoNombre: nombre, adjuntoMime: mime, adjuntoStorageKey: guardado.storageKey, adjuntoBase64: guardado.contenidoBase64 };
    }

    const noticia = await prisma.noticia.create({
      data: { empresaId: empresa.id, titulo: String(body.titulo).trim(), cuerpo: String(body.cuerpo).trim(), centroCostoId, requiereAcuse: body.requiereAcuse === true, publicadaPor: sesion.email, ...adjunto },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: noticia.id });
  } catch (e: any) {
    console.error("Error en POST /api/noticias:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo publicar la noticia." }, { status: 500 });
  }
}
