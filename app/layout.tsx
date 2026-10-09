import "./globals.css";
import Nav from "./Nav";
import { headers } from "next/headers";

// noindex/nofollow — este sistema maneja datos reales de sueldos, no tiene
// que aparecer en Google ni en ningún buscador. Ver también app/robots.ts,
// que bloquea el rastreo de raíz — esto es una segunda capa, porque el
// robots.txt es solo una sugerencia que un buscador podría ignorar.
export const metadata = {
  title: "FM RRHH",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "";
  // /terminal (kiosco) y /portal (empleado) manejan su propio marco — sin el padding del panel.
  const esTerminal = pathname.startsWith("/terminal") || pathname === "/portal" || pathname.startsWith("/portal/");
  return (
    <html lang="es">
      <body>
        <Nav />
        <div style={esTerminal ? undefined : { padding: "1.5rem 2rem 2rem" }}>{children}</div>
      </body>
    </html>
  );
}
