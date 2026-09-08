// FM RRHH — app/api/auditar/route.ts
// Corre auditarPeriodo() (motor-auditoria.mjs, sin tocarlo) contra los datos
// reales de la última liquidación del período. Se llama después de liquidar,
// nunca antes — no tiene sentido auditar liquidaciones que no existen.
import { NextResponse } from "next/server";
import { obtenerResultadoAuditoria } from "@/lib/auditoria-context";

export async function POST(req: Request) {
  try {
    const { periodoId } = await req.json();
    if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });
    const resultado = await obtenerResultadoAuditoria(periodoId);
    return NextResponse.json(resultado);
  } catch (e: any) {
    // Red de seguridad que esta ruta no tenía — un periodoId inválido (por
    // ejemplo, de un typo al escribirlo a mano) tiraba un error sin
    // control, y el cliente recibía una respuesta vacía en vez de JSON
    // ("Unexpected end of JSON input"). Ahora siempre devuelve algo que
    // res.json() puede parsear.
    console.error("Error en POST /api/auditar:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo auditar este período — ¿el periodoId es válido?" }, { status: 500 });
  }
}
