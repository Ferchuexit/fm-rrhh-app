// FM RRHH — app/api/chat/route.ts
// El chat visto por RR.HH.: los grupos de la empresa y las consultas de
// los empleados. Las charlas directas entre compañeros NO aparecen acá.
//   POST accion "grupo"    → crea o edita un grupo
//   POST accion "archivar" / "reactivar"
//   POST accion "abrir"    → abre la consulta con un empleado (para escribirle primero)
//   POST accion "config"   → permite o no los mensajes entre compañeros
import { NextResponse } from "next/server";
import { prisma, sectoresDelUsuarioActual } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { validarGrupo, conversacionConRRHH } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [config, convs, sectores, legajos] = await Promise.all([
      prisma.empresa.findUnique({ where: { id: empresa.id }, select: { chatEntreEmpleados: true } }),
      prisma.conversacion.findMany({ where: { empresaId: empresa.id, tipo: { in: ["grupo", "rrhh"] } }, orderBy: [{ ultimoMensajeEn: { sort: "desc", nulls: "last" } }, { nombre: "asc" }], take: 400 }),
      prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
      // Ya viene filtrado por el alcance: quien está limitado a sectores ve
      // solo a su gente (y por eso, abajo, solo las consultas de su gente).
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, apellido: true, nombre: true, centroCostoId: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
    ]);
    const limitado = (await sectoresDelUsuarioActual()) !== null;
    const persona = new Map(legajos.map((l) => [l.id, l]));
    const consultas = convs.filter((c) => c.tipo === "rrhh" && c.ultimoMensajeEn && c.empleadoId && persona.has(c.empleadoId));
    const sinLeer = await Promise.all(consultas.map((c) => prisma.mensajeChat.count({ where: { conversacionId: c.id, deRRHH: false, borradoEn: null, ...(c.leidoRRHHEn ? { createdAt: { gt: c.leidoRRHHEn } } : {}) } })));
    const grupos = convs.filter((c) => c.tipo === "grupo");
    const agregados = await prisma.miembroConversacion.groupBy({ by: ["conversacionId"], where: { conversacionId: { in: grupos.map((g) => g.id) }, agregado: true }, _count: true });
    const nAgregados = new Map(agregados.map((a) => [a.conversacionId, a._count]));
    return NextResponse.json({
      chatEntreEmpleados: config?.chatEntreEmpleados ?? true, limitado, sectores,
      legajos: legajos.map((l) => ({ id: l.id, nombre: `${l.apellido}, ${l.nombre}`, sector: l.centroCosto?.nombre ?? "Sin asignar" })),
      grupos: grupos.map((g) => ({ id: g.id, nombre: g.nombre, descripcion: g.descripcion, emoji: g.emoji, todos: g.todos, centroCostoIds: g.centroCostoIds, soloAnuncios: g.soloAnuncios, archivada: g.archivada, ultimo: g.ultimoTexto, ultimoEn: g.ultimoMensajeEn, agregados: nAgregados.get(g.id) ?? 0, miembros: g.todos ? legajos.length : new Set([...legajos.filter((l) => l.centroCostoId && g.centroCostoIds.includes(l.centroCostoId)).map((l) => l.id)]).size + (nAgregados.get(g.id) ?? 0) })),
      consultas: consultas.map((c, i) => ({ id: c.id, empleadoId: c.empleadoId, nombre: persona.get(c.empleadoId!)!.nombre + " " + persona.get(c.empleadoId!)!.apellido, sector: persona.get(c.empleadoId!)!.centroCosto?.nombre ?? null, ultimo: c.ultimoTexto, ultimoEn: c.ultimoMensajeEn, sinLeer: sinLeer[i] })),
    });
  } catch (e: any) {
    console.error("Error en GET /api/chat:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para el Chat. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudo cargar el chat. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const limitado = (await sectoresDelUsuarioActual()) !== null;

    if (body.accion === "abrir") {
      // prisma.legajo ya filtra por alcance: no se le abre a alguien de otro sector.
      const l = await prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id, condicion: "activo" }, select: { id: true } });
      if (!l) return NextResponse.json({ error: "No se encontró esa persona." }, { status: 404 });
      return NextResponse.json({ id: (await conversacionConRRHH(empresa.id, l.id)).id });
    }
    // Lo que sigue cambia cosas de toda la empresa.
    if (limitado) return NextResponse.json({ error: "Los grupos y la configuración del chat los maneja RR.HH." }, { status: 403 });

    if (body.accion === "config") {
      await prisma.empresa.update({ where: { id: empresa.id }, data: { chatEntreEmpleados: body.chatEntreEmpleados === true } });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "archivar" || body.accion === "reactivar") {
      const { count } = await prisma.conversacion.updateMany({ where: { id: String(body.id ?? ""), empresaId: empresa.id, tipo: "grupo" }, data: { archivada: body.accion === "archivar" } });
      return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se encontró ese grupo." }, { status: 404 });
    }
    if (body.accion === "grupo") {
      const { datos, error } = validarGrupo(body);
      if (!datos) return NextResponse.json({ error }, { status: 400 });
      const validos = await prisma.centroCosto.count({ where: { id: { in: datos.centroCostoIds }, empresaId: empresa.id } });
      if (validos !== datos.centroCostoIds.length) return NextResponse.json({ error: "Alguno de los sectores ya no existe. Recargá la página." }, { status: 400 });
      if (body.id) {
        const { count } = await prisma.conversacion.updateMany({ where: { id: String(body.id), empresaId: empresa.id, tipo: "grupo" }, data: datos });
        return count ? NextResponse.json({ ok: true, id: body.id }) : NextResponse.json({ error: "No se encontró ese grupo." }, { status: 404 });
      }
      const g = await prisma.conversacion.create({ data: { ...datos, empresaId: empresa.id, tipo: "grupo", creadoPor: sesion.email } });
      return NextResponse.json({ ok: true, id: g.id });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e: any) {
    console.error("Error en POST /api/chat:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
