// FM RRHH — app/api/exportar-personalizado/route.ts
//
// GET ?campos=legajo,cuil,basico,...&periodoId=X&convenioId=Y
//
// Arma un .xlsx real (no CSV) con las columnas que el usuario eligió.
// "Básico" y "Turno" no viven directo en Legajo — se resuelven por
// legajo+convenio+categoría (Escala vigente) y por legajo+convenio (Turno
// del lunes, como referencia representativa). "Bruto"/"Neto"/"Período"/
// "Año" necesitan un período de liquidación elegido — si no se pasa
// periodoId, esas columnas salen vacías (avisado en la respuesta, no
// fallan en silencio).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import * as XLSX from "xlsx";

const ETIQUETAS: Record<string, string> = {
  legajo: "Legajo",
  nombreApellido: "Nombre y Apellido",
  cuil: "CUIL",
  categoria: "Categoría",
  convenio: "Convenio",
  basico: "Básico",
  turno: "Turno",
  sector: "Sector",
  sucursal: "Sucursal",
  dni: "DNI",
  direccion: "Dirección",
  localidad: "Localidad",
  provincia: "Provincia",
  partido: "Partido",
  obraSocial: "Obra Social",
  banco: "Banco",
  cbu: "CBU",
  art: "ART",
  bruto: "Bruto",
  neto: "Neto",
  periodo: "Período",
  anio: "Año",
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const camposStr = searchParams.get("campos");
    const periodoId = searchParams.get("periodoId");
    const convenioId = searchParams.get("convenioId");

    if (!camposStr) return NextResponse.json({ error: "No se eligió ningún campo." }, { status: 400 });
    const campos = camposStr.split(",").filter((c) => c in ETIQUETAS);
    if (campos.length === 0) return NextResponse.json({ error: "Ninguno de los campos pedidos es válido." }, { status: 400 });

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay empresa cargada." }, { status: 400 });

    const necesitaLiquidacion = ["bruto", "neto", "periodo", "anio"].some((c) => campos.includes(c));
    let periodo: any = null;
    let liquidacionPorLegajo = new Map<string, { bruto: number; neto: number }>();
    if (necesitaLiquidacion) {
      if (!periodoId) {
        return NextResponse.json({ error: "Pediste Bruto, Neto, Período o Año — hace falta elegir un período de liquidación." }, { status: 400 });
      }
      periodo = await prisma.periodo.findUnique({ where: { id: periodoId } });
      if (!periodo) return NextResponse.json({ error: "No se encontró ese período." }, { status: 404 });
      const liquidaciones = await prisma.liquidacion.findMany({ where: { periodoId } });
      for (const l of liquidaciones) liquidacionPorLegajo.set(l.legajoId, { bruto: l.bruto, neto: l.neto });
    }

    const legajos = await prisma.legajo.findMany({
      where: { empresaId: empresa.id, condicion: "activo", ...(convenioId ? { convenioId } : {}) },
      orderBy: { numeroLegajo: "asc" },
      include: { convenio: true, categoria: true, centroCosto: true, sucursal: true },
    });

    const necesitaBasico = campos.includes("basico");
    const necesitaTurno = campos.includes("turno");

    const fechaReferencia = periodo?.fechaDesde ?? new Date();

    const escalas = necesitaBasico
      ? await prisma.escala.findMany({
          where: {
            convenioId: { in: legajos.map((l) => l.convenioId) },
            vigenciaDesde: { lte: fechaReferencia },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }],
          },
        })
      : [];

    const turnos = necesitaTurno ? await prisma.turno.findMany({ where: { diaSemana: 1 } }) : []; // lunes, como referencia representativa

    const filas = legajos.map((l) => {
      const fila: Record<string, any> = {};
      for (const campo of campos) {
        switch (campo) {
          case "legajo": fila[ETIQUETAS[campo]] = l.numeroLegajo; break;
          case "nombreApellido": fila[ETIQUETAS[campo]] = `${l.apellido}, ${l.nombre}`; break;
          case "cuil": fila[ETIQUETAS[campo]] = l.cuil; break;
          case "categoria": fila[ETIQUETAS[campo]] = l.categoria.nombre; break;
          case "convenio": fila[ETIQUETAS[campo]] = l.convenio.nombre; break;
          case "basico": {
            const e = escalas.find((e) => e.convenioId === l.convenioId && e.categoriaId === l.categoriaId);
            fila[ETIQUETAS[campo]] = e ? e.basico : null;
            break;
          }
          case "turno": {
            const t = turnos.find((t) => t.legajoId === l.id) ?? turnos.find((t) => t.legajoId === null && t.convenioId === l.convenioId);
            fila[ETIQUETAS[campo]] = t ? `${t.horaIngreso}-${t.horaSalida}` : "";
            break;
          }
          case "sector": fila[ETIQUETAS[campo]] = l.centroCosto?.nombre ?? ""; break;
          case "sucursal": fila[ETIQUETAS[campo]] = l.sucursal?.nombre ?? ""; break;
          case "dni": fila[ETIQUETAS[campo]] = l.numeroDocumento ?? ""; break;
          case "direccion": fila[ETIQUETAS[campo]] = l.domicilio ?? ""; break;
          case "localidad": fila[ETIQUETAS[campo]] = l.localidad ?? ""; break;
          case "provincia": fila[ETIQUETAS[campo]] = l.provincia ?? ""; break;
          case "partido": fila[ETIQUETAS[campo]] = l.partido ?? ""; break;
          case "obraSocial": fila[ETIQUETAS[campo]] = l.obraSocialId ?? ""; break;
          case "banco": fila[ETIQUETAS[campo]] = l.bancoId ?? ""; break;
          case "cbu": fila[ETIQUETAS[campo]] = l.cbu ?? ""; break;
          case "art": fila[ETIQUETAS[campo]] = l.artNombre ?? ""; break;
          case "bruto": fila[ETIQUETAS[campo]] = liquidacionPorLegajo.get(l.id)?.bruto ?? null; break;
          case "neto": fila[ETIQUETAS[campo]] = liquidacionPorLegajo.get(l.id)?.neto ?? null; break;
          case "periodo": fila[ETIQUETAS[campo]] = periodo?.nombre ?? ""; break;
          case "anio": fila[ETIQUETAS[campo]] = periodo ? new Date(periodo.fechaDesde).getUTCFullYear() : ""; break;
        }
      }
      return fila;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    ws["!cols"] = campos.map((c) => ({ wch: Math.max(ETIQUETAS[c].length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const nombreArchivo = `Exportacion_${periodo ? periodo.nombre.replace(/[^a-zA-Z0-9]/g, "_") : new Date().toISOString().substring(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      },
    });
  } catch (e: any) {
    console.error("Error en GET /api/exportar-personalizado:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo exportar." }, { status: 500 });
  }
}
