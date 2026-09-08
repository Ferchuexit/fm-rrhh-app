// FM RRHH — app/api/reportes/asistencia-diaria/route.ts
//
// GET ?fecha=YYYY-MM-DD → devuelve el PDF directo, para descargar/previsualizar.
// POST { fecha, destinatarios: string[] } → genera el mismo PDF y lo manda por mail.
//
// "Presente" acá = P, T, SA, S (vino, de alguna forma). "Ausente" = A, AA
// (falta real, con o sin aviso). Todo lo demás (licencias, ART, vacaciones,
// feriado, sin dato) se cuenta aparte — no se mezcla con ausentismo real,
// porque mezclar vacaciones con faltas sin aviso le arruinaría el número a
// Dirección.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { generarReporteAsistenciaDiariaPDF, type DatosReporteAsistenciaDiaria } from "@/lib/reportes/asistencia-diaria-pdf";
import { enviarEmail } from "@/lib/email";

const ESTADOS_PRESENTE = ["P", "T", "SA", "S"];
const ESTADOS_AUSENTE = ["A", "AA"];
const ESTADOS_LICENCIA = ["E", "ES", "AC", "ACS", "SUS", "LP", "VC", "VCS", "F"];
const ESTADOS_SIN_DATO = ["SIN_TURNO", "SIN_CONTROL", "IMPAR"];
const NOMBRE_MOTIVO: Record<string, string> = { A: "Sin aviso", AA: "Con aviso" };

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function formatearFecha(fecha: Date) {
  return `${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;
}

async function armarDatosReporte(fechaStr: string): Promise<DatosReporteAsistenciaDiaria | { error: string }> {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return { error: "No hay empresa cargada." };

  const fecha = new Date(fechaStr + "T00:00:00.000Z");

  const legajos = await prisma.legajo.findMany({
    where: { empresaId: empresa.id, condicion: "activo" },
    include: { convenio: true, categoria: true },
  });

  const asistencias = await prisma.asistenciaDia.findMany({
    where: { legajoId: { in: legajos.map((l) => l.id) }, fecha },
  });
  const asistenciaPorLegajo = new Map(asistencias.map((a) => [a.legajoId, a]));

  let presentes = 0, ausentes = 0, conLicenciaOJustificado = 0, sinDatoCargado = 0;
  const listaAusentes: DatosReporteAsistenciaDiaria["listaAusentes"] = [];
  const porConvenioMap = new Map<string, { activos: number; presentes: number; ausentes: number }>();

  for (const l of legajos) {
    const a = asistenciaPorLegajo.get(l.id);
    const estado = a?.estado ?? "SIN_TURNO"; // sin registro = tratado como dato faltante, no como ausente

    if (!porConvenioMap.has(l.convenio.nombre)) porConvenioMap.set(l.convenio.nombre, { activos: 0, presentes: 0, ausentes: 0 });
    const cv = porConvenioMap.get(l.convenio.nombre)!;
    cv.activos++;

    if (ESTADOS_PRESENTE.includes(estado)) { presentes++; cv.presentes++; }
    else if (ESTADOS_AUSENTE.includes(estado)) {
      ausentes++; cv.ausentes++;
      listaAusentes.push({
        numero: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre,
        convenio: l.convenio.nombre, categoria: l.categoria.nombre,
        motivo: NOMBRE_MOTIVO[estado] ?? estado,
      });
    }
    else if (ESTADOS_LICENCIA.includes(estado)) conLicenciaOJustificado++;
    else if (ESTADOS_SIN_DATO.includes(estado)) sinDatoCargado++;
    // FRANCO no se cuenta en ningún bucket — es el día libre normal de esa persona.
  }

  return {
    empresa: empresa.razonSocial,
    fecha: formatearFecha(fecha),
    totalActivos: legajos.length,
    presentes,
    ausentes,
    conLicenciaOJustificado,
    sinDatoCargado,
    porConvenio: [...porConvenioMap.entries()].map(([convenio, v]) => ({ convenio, ...v })),
    listaAusentes: listaAusentes.sort((a, b) => a.numero - b.numero),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get("fecha") ?? new Date().toISOString().substring(0, 10);

  const datos = await armarDatosReporte(fecha);
  if ("error" in datos) return NextResponse.json(datos, { status: 400 });

  const pdfBytes = await generarReporteAsistenciaDiariaPDF(datos);
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="asistencia_diaria_${fecha}.pdf"`,
    },
  });
}

export async function POST(req: Request) {
  try {
    const { fecha, destinatarios } = await req.json();
    if (!fecha) return NextResponse.json({ error: "Falta la fecha." }, { status: 400 });
    if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
      return NextResponse.json({ error: "No hay destinatarios." }, { status: 400 });
    }

    const datos = await armarDatosReporte(fecha);
    if ("error" in datos) return NextResponse.json(datos, { status: 400 });

    const pdfBytes = await generarReporteAsistenciaDiariaPDF(datos);

    const resultado = await enviarEmail({
      destinatarios,
      asunto: `Reporte de Asistencia Diaria — ${datos.fecha}`,
      html: `
        <p>Hola,</p>
        <p>Adjunto el reporte de asistencia diaria de <strong>${datos.empresa}</strong> correspondiente al <strong>${datos.fecha}</strong>.</p>
        <p>Resumen rápido: <strong>${datos.presentes}</strong> presentes, <strong>${datos.ausentes}</strong> ausentes, sobre una dotación de <strong>${datos.totalActivos}</strong>.</p>
        <p style="font-size: 0.85em; color: #888;">Generado automáticamente por FM RRHH.</p>
      `,
      adjuntos: [{ nombreArchivo: `asistencia_diaria_${fecha}.pdf`, contenido: Buffer.from(pdfBytes) }],
    });

    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 502 });
    return NextResponse.json({ enviado: true, id: resultado.id });
  } catch (e: any) {
    console.error("Error en POST /api/reportes/asistencia-diaria:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo enviar el reporte." }, { status: 500 });
  }
}
