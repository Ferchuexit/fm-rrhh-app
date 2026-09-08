import { NextResponse } from "next/server";
import { NOMBRE_COOKIE } from "@/lib/auth";

// GET a propósito, no POST — así funciona como un <a href="/api/logout">
// plano, sin necesitar un componente cliente solo para el botón de salir.
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(NOMBRE_COOKIE);
  return res;
}
