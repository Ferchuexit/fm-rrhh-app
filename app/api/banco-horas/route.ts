// FM RRHH — app/api/banco-horas/route.ts
// Banco de horas de la empresa actual (docs/102).
//   GET → personas con su acuerdo y su saldo, y los períodos abiertos
//   POST accion "acuerdo"     → crea el acuerdo para una o varias personas
//   POST accion "papel"       → marca que firmó el acuerdo impreso
//   POST accion "terminar"    → deja el acuerdo sin efecto desde una fecha
//   POST accion "movimiento"  → acredita, compensa o ajusta a mano
//   POST accion "pagar"       → paga horas del banco (novedad en el período)
//   POST accion "resolver"    → aprueba o rechaza un pedido del portal
//   POST accion "anular"      → anula un movimiento (no se borra)
//   POST accion "confirmar"   → lo que se decidió de las horas detectadas
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina, fechaDesdeTexto } from "@/lib/ausencias-reglas";
import { avisar } from "@/lib/avisos";
import {
  estadoBanco, periodosAbiertos, crearAcuerdos, registrarMovimiento, pagarDelBanco, resolverPedido, anularMovimiento, confirmarDetectadas, detalleBanco,
  validarAcuerdo, validarMovimiento, minutosDesdeTexto, textoHoras, estadoAcuerdo,
} from "@/lib/banco-horas";

export const dynamic = "force-dynamic";

const fallo = (e: any, que: string) => {
  console.error(`Error en ${que} /api/banco-horas:`, e);
  if (e?.name === "FueraDeAlcance") return NextResponse.json({ error: "Eso está fuera de los sectores que tenés asignados." }, { status: 403 });
  const faltaBase = e?.code === "P2021" || e?.code === "P2022";
  return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para el banco de horas. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudo completar. Probá de nuevo en un momento." }, { status: 500 });
};

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const hoy = hoyArgentina();
    const [estado, periodos] = await Promise.all([estadoBanco(empresa.id, hoy), periodosAbiertos(empresa.id)]);
    return NextResponse.json({ hoy, periodos, ...estado });
  } catch (e) {
    return fallo(e, "GET");
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const hoy = hoyArgentina();
    const ok = (r: { error: string; status: number } | ({ ok: true } & object)) => ("error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r));

    if (body.accion === "acuerdo") {
      const { datos, error } = validarAcuerdo(body, hoy);
      if (!datos) return NextResponse.json({ error }, { status: 400 });
      const ids = Array.isArray(body.legajoIds) ? body.legajoIds.map(String) : [];
      const r = await crearAcuerdos(empresa.id, ids, datos, sesion.email, hoy);
      if ("error" in r) return ok(r);
      if (r.creados) await avisar(r.ids, { tipo: "banco_horas", titulo: "Tenés un acuerdo de banco de horas para leer", cuerpo: "La empresa te propone compensar horas extra con descanso. Leelo en el portal y, si estás de acuerdo, aceptalo. Es voluntario.", url: "/portal/horas" });
      return NextResponse.json(r);
    }
    if (body.accion === "papel" || body.accion === "terminar") {
      const a = await prisma.acuerdoBancoHoras.findFirst({ where: { id: String(body.id ?? ""), legajo: { empresaId: empresa.id } } });
      if (!a) return NextResponse.json({ error: "No se encontró ese acuerdo." }, { status: 404 });
      if (body.accion === "papel") {
        if (a.aceptadoEn) return NextResponse.json({ error: "Ese acuerdo ya lo aceptó desde el portal." }, { status: 409 });
        await prisma.acuerdoBancoHoras.update({ where: { id: a.id }, data: { enPapel: body.valor !== false } });
        return NextResponse.json({ ok: true });
      }
      if (estadoAcuerdo(a, hoy) === "terminado") return NextResponse.json({ error: "Ese acuerdo ya estaba terminado." }, { status: 409 });
      const desde = body.fecha ? fechaDesdeTexto(body.fecha) : hoy;
      if (!desde || desde < a.desde) return NextResponse.json({ error: "La fecha no es válida (tiene que ser posterior al inicio del acuerdo)." }, { status: 400 });
      await prisma.acuerdoBancoHoras.update({ where: { id: a.id }, data: { finalizadoEn: desde } });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "movimiento") {
      const det = await detalleBanco(String(body.legajoId ?? ""), empresa.id, hoy);
      if (!det) return NextResponse.json({ error: "No se encontró esa persona." }, { status: 404 });
      const { datos, error } = validarMovimiento(body, det.disponible, hoy);
      if (!datos) return NextResponse.json({ error }, { status: 400 });
      const r = await registrarMovimiento(empresa.id, det.persona.id, datos, sesion.email, hoy);
      if ("ok" in r && datos.tipo === "acreditacion") await avisar([det.persona.id], { tipo: "banco_horas", titulo: "Se sumaron horas a tu banco", cuerpo: "Mirá tu saldo y cuándo vencen en el portal.", url: "/portal/horas" }, { sinMail: true });
      return ok(r);
    }
    if (body.accion === "pagar") {
      const minutos = minutosDesdeTexto(body.horas);
      if (!minutos) return NextResponse.json({ error: "Poné cuántas horas del banco se pagan, por ejemplo 4 o 1:30." }, { status: 400 });
      const l = await prisma.legajo.findFirst({ where: { id: String(body.legajoId ?? ""), empresaId: empresa.id }, select: { id: true } });
      if (!l) return NextResponse.json({ error: "No se encontró esa persona." }, { status: 404 });
      return ok(await pagarDelBanco(empresa.id, l.id, minutos, String(body.periodoId ?? ""), sesion.email, hoy));
    }
    if (body.accion === "resolver") {
      const aprobar = body.aprobar === true;
      const r = await resolverPedido(empresa.id, String(body.id ?? ""), aprobar, body.periodoId ? String(body.periodoId) : null, sesion.email, hoy, String(body.motivo ?? "").trim().slice(0, 300) || null);
      if ("error" in r) return ok(r);
      const que = r.tipo === "pago" ? "cobrar horas del banco" : "usar horas del banco";
      await avisar([r.legajoId], { tipo: "banco_horas", titulo: aprobar ? `Aprobaron tu pedido para ${que}` : `No aprobaron tu pedido para ${que}`, cuerpo: aprobar ? "Mirá el detalle en el portal." : "Mirá el motivo en el portal o consultá a RR.HH.", url: "/portal/horas" });
      return NextResponse.json({ ok: true });
    }
    if (body.accion === "anular") {
      const motivo = String(body.motivo ?? "").trim().slice(0, 300);
      if (!motivo) return NextResponse.json({ error: "Poné por qué se anula: queda en el historial." }, { status: 400 });
      return ok(await anularMovimiento(empresa.id, String(body.id ?? ""), motivo));
    }
    if (body.accion === "confirmar") {
      const r = await confirmarDetectadas(empresa.id, body.items, body.periodoId ? String(body.periodoId) : null, sesion.email, hoy);
      if ("error" in r) return ok(r);
      if (r.personasBanco.length) await avisar(r.personasBanco, { tipo: "banco_horas", titulo: "Se sumaron horas a tu banco", cuerpo: "Mirá tu saldo y cuándo vencen en el portal.", url: "/portal/horas" }, { sinMail: true });
      return NextResponse.json(r);
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    return fallo(e, "POST");
  }
}
