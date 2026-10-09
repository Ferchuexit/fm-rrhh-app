// FM RRHH — app/api/portal/recibos/[id]/pdf/route.ts
// El PDF del recibo para el empleado — el mismo generador que usa RR.HH.
// (lib/recibo-pdf.ts), pero solo si esa liquidación es SUYA.
import { NextResponse } from "next/server";
import { generarReciboPDF } from "@/lib/recibo-pdf";
import { armarDatosRecibo } from "@/lib/armar-recibo";
import { obtenerSesionPortal, liquidacionDelEmpleado, registrarVista } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

  // Mismo 404 si no existe que si es de otra persona: no confirmar nada.
  const liq = await liquidacionDelEmpleado(params.id, sesion.legajoId);
  const datos = liq ? await armarDatosRecibo(liq.legajoId, liq.periodoId) : null;
  if (!liq || !datos) return NextResponse.json({ error: "No se encontró ese recibo." }, { status: 404 });

  await registrarVista(liq.id, sesion.legajoId);
  const pdf = await generarReciboPDF(datos);
  const nombre = `recibo_${liq.periodo.nombre}`.replace(/[^\w.-]+/g, "_");
  const descargar = new URL(req.url).searchParams.get("descargar") === "1";

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
