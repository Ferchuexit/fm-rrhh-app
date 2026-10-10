// FM RRHH — app/api/cron/recordatorios/route.ts
// La llama Vercel una vez por día (vercel.json). No tiene sesión de usuario:
// se protege con CRON_SECRET, una clave que Vercel manda sola en el
// encabezado Authorization cuando está cargada en las variables de entorno.
// Sin esa variable la tarea NO corre: es preferible que no salgan
// recordatorios a que cualquiera pueda dispararlos desde afuera.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { hoyArgentina, fechaDesdeTexto } from "@/lib/ausencias-reglas";
import { correrRecordatoriosDelDia } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return false;
  const recibido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const url = new URL(req.url);
    // ?forzar=1 vuelve a correr el día (para probar). Igual pide la clave.
    // Solo en desarrollo: ?fecha=2026-10-12 simula otro día (para probar lo
    // que sale los lunes). En producción se ignora.
    const simulada = process.env.NODE_ENV !== "production" ? fechaDesdeTexto(url.searchParams.get("fecha")) : null;
    const r = await correrRecordatoriosDelDia(simulada ?? hoyArgentina(), url.searchParams.get("forzar") === "1");
    return NextResponse.json(r.corrio ? { ok: true, resumen: r.resumen } : { ok: true, mensaje: "Los recordatorios de hoy ya habían salido." });
  } catch (e) {
    console.error("Error en /api/cron/recordatorios:", e);
    return NextResponse.json({ error: "Falló la tarea de recordatorios." }, { status: 500 });
  }
}
