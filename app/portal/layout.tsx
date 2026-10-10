// FM RRHH — app/portal/layout.tsx
// Marco del PORTAL DEL EMPLEADO: encabezado propio con el nombre de la
// empresa (no el menú del sistema — Nav.tsx no se dibuja en /portal).
import type { Metadata, Viewport } from "next";
import "./portal.css";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import PortalBarra from "./PortalBarra";
import { noticiasPendientes } from "@/lib/noticias";

// manifest + íconos: lo que deja "instalar" el portal en el celular como
// una app (y, en iPhone, lo que habilita las notificaciones).
export const metadata: Metadata = {
  title: "Portal del empleado",
  manifest: "/portal/app.webmanifest",
  icons: { icon: "/portal/icono-192.png", apple: "/portal/icono-180.png" },
  appleWebApp: { capable: true, title: "Portal", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#163A5C", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesionPortal();
  const empresa = sesion
    ? await prisma.empresa.findUnique({ where: { id: sesion.empresaId }, select: { razonSocial: true, nombreFantasia: true } })
    : null;

  // Globito de noticias en la barra: es lo único que puede aparecer sin que
  // el empleado haya hecho nada, así que se muestra en todas las pantallas.
  // Si falla (por ejemplo, falta la migración), el portal abre igual.
  const noticiasSinAtender = sesion && !sesion.debeCambiarPin ? await noticiasPendientes(sesion.legajoId).catch(() => 0) : 0;

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
      {sesion && !sesion.debeCambiarPin && <PortalBarra globos={{ noticias: noticiasSinAtender }} />}
    </div>
  );
}
