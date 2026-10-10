// FM RRHH — app/api/turnos/route.ts
// Todo lo que necesita la pantalla Turnos de una vez: los horarios de la
// empresa y, para la semana pedida, qué le toca a cada persona cada día.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto, hoyArgentina } from "@/lib/ausencias-reglas";
import { horariosDeEmpresa, vistaDeJornada, jornadaDelDia, asignacionVigente, lunesDe, resumenHorario } from "@/lib/turnos";

export const dynamic = "force-dynamic";
const DIA_MS = 24 * 3600 * 1000;

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const lunes = lunesDe(fechaDesdeTexto(new URL(req.url).searchParams.get("semana")) ?? hoyArgentina());

    const [horarios, legajos] = await Promise.all([
      horariosDeEmpresa(empresa.id),
      prisma.legajo.findMany({
        where: { empresaId: empresa.id, condicion: "activo" },
        select: {
          id: true, numeroLegajo: true, apellido: true, nombre: true, centroCostoId: true, centroCosto: { select: { nombre: true } },
          asignacionesHorario: { select: { desde: true, hasta: true, horarioIds: true } },
        },
        orderBy: { numeroLegajo: "asc" },
      }),
    ]);
    const dias = Array.from({ length: 7 }, (_, i) => new Date(lunes.getTime() + i * DIA_MS));

    return NextResponse.json({
      semana: lunes,
      horarios: [...horarios.values()].map((h) => ({ ...h, resumen: resumenHorario(h.dias) })),
      legajos: legajos.map((l) => {
        // La asignación que vale esta semana; si no hay, la próxima que arranca.
        const vigente = asignacionVigente(dias[6], l.asignacionesHorario) ?? asignacionVigente(dias[0], l.asignacionesHorario);
        const proxima = l.asignacionesHorario.filter((a) => a.desde > dias[6]).sort((a, b) => a.desde.getTime() - b.desde.getTime())[0] ?? null;
        return {
          id: l.id, numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, centroCostoId: l.centroCostoId, sector: l.centroCosto?.nombre ?? "Sin asignar",
          asignacion: vigente ? { desde: vigente.desde, horarioIds: vigente.horarioIds } : null,
          proxima: proxima ? { desde: proxima.desde, horarioIds: proxima.horarioIds } : null,
          jornadas: dias.map((d) => vistaDeJornada(jornadaDelDia(d, l.asignacionesHorario, horarios))),
        };
      }),
    });
  } catch (e: any) {
    console.error("Error en GET /api/turnos:", e);
    const faltaBase = e?.code === "P2021" || e?.code === "P2022";
    return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para Turnos. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudieron cargar los turnos. Probá de nuevo en un momento." }, { status: 500 });
  }
}
