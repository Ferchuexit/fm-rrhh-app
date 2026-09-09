import "./globals.css";
import Nav from "./Nav";

// noindex/nofollow — este sistema maneja datos reales de sueldos, no tiene
// que aparecer en Google ni en ningún buscador. Ver también app/robots.ts,
// que bloquea el rastreo de raíz — esto es una segunda capa, porque el
// robots.txt es solo una sugerencia que un buscador podría ignorar.
export const metadata = {
  title: "FM RRHH",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Nav />
        <div style={{ padding: "1.5rem 2rem 2rem" }}>{children}</div>
      </body>
    </html>
  );
}
