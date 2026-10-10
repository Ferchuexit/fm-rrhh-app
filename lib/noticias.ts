// FM RRHH — lib/noticias.ts
// Lado base de datos de las noticias.
import { prisma } from "./prisma";
import { estadoLectura } from "./noticias-reglas";
export * from "./noticias-reglas";

// El "where" de Prisma equivalente a esDestinatario() — mismo criterio,
// resuelto en la base para no traer noticias que no son del empleado.
function filtroDestinatario(legajo: { empresaId: string; centroCostoId: string | null }) {
  return {
    empresaId: legajo.empresaId,
    estado: "publicada",
    OR: [{ centroCostoId: null }, ...(legajo.centroCostoId ? [{ centroCostoId: legajo.centroCostoId }] : [])],
  };
}

export async function noticiasDelEmpleado(legajoId: string) {
  const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true } });
  const noticias = await prisma.noticia.findMany({
    where: filtroDestinatario(legajo),
    select: { id: true, titulo: true, cuerpo: true, requiereAcuse: true, publicadaEn: true, adjuntoMime: true, lecturas: { where: { legajoId }, select: { leidaEn: true, acuseEn: true } } },
    orderBy: { publicadaEn: "desc" },
    take: 100,
  });
  return noticias.map((n) => ({ ...n, estado: estadoLectura(n.requiereAcuse, n.lecturas[0]) }));
}

// Una noticia, solo si le corresponde a este empleado.
export async function noticiaDelEmpleado(noticiaId: string, legajoId: string) {
  const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: legajoId }, select: { empresaId: true, centroCostoId: true } });
  return prisma.noticia.findFirst({ where: { id: noticiaId, ...filtroDestinatario(legajo) }, include: { lecturas: { where: { legajoId } } } });
}

// Cuántas le quedan por atender (no leídas + acuses que debe) — para el globito.
export async function noticiasPendientes(legajoId: string): Promise<number> {
  return (await noticiasDelEmpleado(legajoId)).filter((n) => n.estado !== "al_dia").length;
}

// A quiénes les llega una noticia HOY: activos de la empresa, del sector si tiene.
export function filtroAudiencia(noticia: { empresaId: string; centroCostoId: string | null }) {
  return { empresaId: noticia.empresaId, condicion: "activo", ...(noticia.centroCostoId ? { centroCostoId: noticia.centroCostoId } : {}) };
}
