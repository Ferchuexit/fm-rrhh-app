import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOMBRE_COOKIE_EMPRESA, obtenerEmpresaActual, obtenerEmpresasAutorizadas } from "@/lib/empresa-actual";
import { obtenerSesionActual } from "@/lib/auth";

export async function GET() {
  const empresas = await obtenerEmpresasAutorizadas();
  const actual = await obtenerEmpresaActual();
  return NextResponse.json({ empresas, actualId: actual?.id ?? null });
}

export async function POST(req: Request) {
  const { empresaId } = await req.json();

  // Antes esto aceptaba CUALQUIER empresaId sin preguntar nada — el hueco
  // real que describía el documento de mejora. Ahora se verifica que la
  // empresa esté en la lista de empresas AUTORIZADAS para este usuario
  // (admin = todas; cualquier otro rol = solo las que tenga en
  // UsuarioEmpresa), antes de aceptar el cambio.
  const empresasAutorizadas = await obtenerEmpresasAutorizadas();
  const empresa = empresasAutorizadas.find((e) => e.id === empresaId);
  if (!empresa) {
    return NextResponse.json({ error: "No tenés acceso a esa empresa." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, empresa });
  res.cookies.set(NOMBRE_COOKIE_EMPRESA, empresaId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
