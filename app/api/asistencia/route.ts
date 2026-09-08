// FM RRHH — app/api/asistencia/route.ts
//
// GET ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&convenioId=X&legajoId=Y1,Y2
//
// Devuelve la grilla lista para pintar: legajos (filtrados), la lista de
// días del rango, y las celdas (AsistenciaDia) indexadas por legajo+fecha
// para que el cliente no tenga que buscar en un array por cada celda.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { obtenerPeriodosCerrados, fechaEstaCerrada } from "@/lib/periodo-asistencia-lock";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const desdeStr = searchParams.get("desde");
    const hastaStr = searchParams.get("hasta");
    const convenioId = searchParams.get("convenioId");
    const legajoIdsStr = searchParams.get("legajoId"); // coma-separado, opcional

    if (!desdeStr || !hastaStr) {
      return NextResponse.json({ error: "Faltan desde/hasta." }, { status: 400 });
    }

    const desde = new Date(desdeStr + "T00:00:00.000Z");
    const hasta = new Date(hastaStr + "T00:00:00.000Z");

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

    const legajoIds = legajoIdsStr ? legajoIdsStr.split(",").filter(Boolean) : null;

    const legajos = await prisma.legajo.findMany({
      where: {
        empresaId: empresa.id,
        condicion: "activo",
        ...(convenioId ? { convenioId } : {}),
        ...(legajoIds ? { id: { in: legajoIds } } : {}),
      },
      orderBy: { numeroLegajo: "asc" },
      select: { id: true, numeroLegajo: true, apellido: true, nombre: true, convenioId: true, fichadaObligatoria: true },
    });

    const legajoIdsFiltrados = legajos.map((l) => l.id);

    const asistencias = legajoIdsFiltrados.length
      ? await prisma.asistenciaDia.findMany({
          where: { legajoId: { in: legajoIdsFiltrados }, fecha: { gte: desde, lte: hasta } },
        })
      : [];

    // días del rango, para que el cliente arme las columnas sin calcular fechas
    const dias: string[] = [];
    for (const d = new Date(desde); d <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
      dias.push(d.toISOString().substring(0, 10));
    }

    const celdas: Record<string, Record<string, any>> = {};
    for (const a of asistencias) {
      const fechaISO = a.fecha.toISOString().substring(0, 10);
      if (!celdas[a.legajoId]) celdas[a.legajoId] = {};
      celdas[a.legajoId][fechaISO] = {
        estado: a.estado,
        horaIngresoReal: a.horaIngresoReal,
        horaEgresoReal: a.horaEgresoReal,
        minutosTarde: a.minutosTarde,
        minutosSalidaAnticipada: a.minutosSalidaAnticipada,
        origen: a.origen,
        motivoManual: a.motivoManual,
      };
    }

    const periodosCerrados = await obtenerPeriodosCerrados(empresa.id);
    const diasCerrados = dias.filter((f) => fechaEstaCerrada(new Date(f + "T00:00:00.000Z"), periodosCerrados));

    return NextResponse.json({
      legajos: legajos.map((l) => ({
        id: l.id,
        numero: l.numeroLegajo,
        apellido: l.apellido,
        nombre: l.nombre,
        convenioId: l.convenioId,
        fichadaObligatoria: l.fichadaObligatoria,
      })),
      dias,
      celdas,
      diasCerrados, // fechas ISO que caen en algún período ya cerrado — la grilla las bloquea
    });
  } catch (e: any) {
    console.error("Error en GET /api/asistencia:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo cargar la asistencia." }, { status: 500 });
  }
}

// PATCH: sobreescritura manual de UN día — licencias, vacaciones, feriados,
// o corregir algo que el motor clasificó mal. Igual que en el Excel (VC/E/ES
// pisaban la fórmula automática): una vez marcado origen='manual', el motor
// automático (clasificar-asistencia.ts) no lo vuelve a tocar.
export async function PATCH(req: Request) {
  try {
    const { legajoId, fecha, estado, motivoManual } = await req.json();
    if (!legajoId || !fecha || !estado) {
      return NextResponse.json({ error: "Faltan legajoId, fecha o estado." }, { status: 400 });
    }

    const fechaDate = new Date(fecha + "T00:00:00.000Z");

    const empresa = await obtenerEmpresaActual();
    if (empresa) {
      const cerrados = await obtenerPeriodosCerrados(empresa.id);
      const cerrado = fechaEstaCerrada(fechaDate, cerrados);
      if (cerrado) {
        return NextResponse.json(
          { error: `Este día pertenece al período "${cerrado.nombre}", ya cerrado — no se puede editar. Si hace falta corregirlo, hay que reabrir ese período primero.` },
          { status: 409 }
        );
      }
    }

    const actualizado = await prisma.asistenciaDia.upsert({
      where: { legajoId_fecha: { legajoId, fecha: fechaDate } },
      create: { legajoId, fecha: fechaDate, estado, origen: "manual", motivoManual: motivoManual || null },
      update: { estado, origen: "manual", motivoManual: motivoManual || null },
    });

    return NextResponse.json(actualizado);
  } catch (e: any) {
    console.error("Error en PATCH /api/asistencia:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo guardar la corrección." }, { status: 500 });
  }
}
