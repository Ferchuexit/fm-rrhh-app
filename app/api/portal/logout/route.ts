import { NextResponse } from "next/server";
import { NOMBRE_COOKIE_PORTAL } from "@/lib/portal-edge";

// GET a propósito (igual que /api/logout): funciona como un link plano.
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/portal/login", req.url));
  res.cookies.delete(NOMBRE_COOKIE_PORTAL);
  return res;
}
