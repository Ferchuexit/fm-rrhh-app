// FM RRHH — app/portal/layout.tsx
// Marco del PORTAL DEL EMPLEADO: encabezado propio con el nombre de la
// empresa (no el menú del sistema — Nav.tsx no se dibuja en /portal).
import type { Metadata, Viewport } from "next";
import "./portal.css";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";

export const metadata: Metadata = { title: "Portal del empleado" };
export const viewport: Viewport = { themeColor: "#163A5C", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesionPortal();
  const empresa = sesion
    ? await prisma.empresa.findUnique({ where: { id: sesion.empresaId }, select: { razonSocial: true, nombreFantasia: true } })
    : null;

  return (
    <div className="portal">
      <header className="portal-header">
        <div className="portal-header-in">
          <a href="/portal" className="portal-empresa" style={{ textDecoration: "none" }}>
            {empresa ? empresa.nombreFantasia || empresa.razonSocial : "Portal del empleado"}
            {empresa && <small>Portal del empleado</small>}
          </a>
          {sesion && (
            <a href="/api/portal/logout" className="portal-salir">Salir</a>
          )}
        </div>
      </header>
      <main className="portal-main">{children}</main>
    </div>
  );
}
