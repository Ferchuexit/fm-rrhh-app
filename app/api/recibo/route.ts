// FM RRHH — app/api/recibo/route.ts
// GET /api/recibo?legajoId=...&periodoId=... — devuelve el PDF directo,
// no JSON. Requiere que el legajo ya esté liquidado en ese período (si no,
// 404 con un mensaje claro en vez de generar un recibo con ceros).
//
// Formato conforme Ley 27.802 / Decreto 407/2026 — ver 54-recibo-ley27802.md.
// La lógica de armado de datos vive en lib/armar-recibo.ts, compartida con
// la descarga masiva de /api/recibos/exportar — ver 60-recibos-masivos.md.
import { NextResponse } from "next/server";
import { generarReciboPDF } from "@/lib/recibo-pdf";
import { armarDatosRecibo } from "@/lib/armar-recibo";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const legajoId = searchParams.get("legajoId");
  const periodoId = searchParams.get("periodoId");

  if (!legajoId || !periodoId) {
    return NextResponse.json({ error: "Faltan legajoId y/o periodoId" }, { status: 400 });
  }

  const datos = await armarDatosRecibo(legajoId, periodoId);
  if (!datos) {
    return NextResponse.json(
      { error: "Este legajo todavía no tiene una liquidación en este período. Liquidá primero en /liquidar." },
      { status: 404 }
    );
  }

  const pdfBytes = await generarReciboPDF(datos);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recibo_${datos.legajo.numero}_${datos.legajo.apellido}.pdf"`,
    },
  });
}
