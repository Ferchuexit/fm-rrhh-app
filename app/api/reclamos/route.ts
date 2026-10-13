// FM RRHH — app/api/reclamos/route.ts
// Reclamos de haberes de la empresa actual (docs/103).
//   GET → los reclamos y la lista de motivos
//   POST accion "resolver" → la respuesta de RR.HH. (y las novedades del ajuste)
//   POST accion "motivos"  → guarda la lista de motivos de la empresa (o vuelve a la estándar)
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { avisar } from "@/lib/avisos";
import { bandejaReclamos, motivosDeEmpresa, resolverReclamo, limpiarMotivos } from "@/lib/reclamos";

export const dynamic = "force-dynamic";

const fallo = (e: any, que: string) => {
  console.error(`Error en ${que} /api/reclamos:`, e);
  if (e?.name === "FueraDeAlcance") return NextResponse.json({ error: "Eso está fuera de los sectores que tenés asignados." }, { status: 403 });
  const faltaBase = e?.code === "P2021" || e?.code === "P2022";
  return NextResponse.json({ error: faltaBase ? "La base de datos no está actualizada para los reclamos. Frená el servidor y corré: npx prisma migrate deploy, después npx prisma generate, y volvé a iniciar." : "No se pudo completar. Probá de nuevo en un momento." }, { status: 500 });
};

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [reclamos, motivos] = await Promise.all([bandejaReclamos(empresa.id), motivosDeEmpresa(empresa.id)]);
    return NextResponse.json({ reclamos, ...motivos });
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
    if (body.accion === "resolver") {
      const r = await resolverReclamo(String(body.id ?? ""), empresa.id, body, sesion.email);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
      // Sin importes en el aviso: se lee con el celular bloqueado.
      await avisar([r.legajoId], { tipo: "reclamo", titulo: "Respondieron tu reclamo de haberes", cuerpo: "Mirá la respuesta en el portal.", url: "/portal/reclamos" });
      return NextResponse.json(r);
    }
    if (body.accion === "motivos") {
      if (body.restaurar === true) {
        await prisma.empresa.update({ where: { id: empresa.id }, data: { motivosReclamo: Prisma.DbNull } });
        return NextResponse.json({ ok: true });
      }
      const { motivos, error } = limpiarMotivos(body.motivos);
      if (error || motivos.length === 0) return NextResponse.json({ error: error ?? "La lista está vacía." }, { status: 400 });
      await prisma.empresa.update({ where: { id: empresa.id }, data: { motivosReclamo: motivos as any } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    return fallo(e, "POST");
  }
}
