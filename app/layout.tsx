import "./globals.css";
import Nav, { rutaSinMenu } from "./Nav";
import { headers } from "next/headers";
import { obtenerSesionActual } from "@/lib/auth";

// noindex/nofollow — este sistema maneja datos reales de sueldos, no tiene
// que aparecer en Google ni en ningún buscador. Ver también app/robots.ts,
// que bloquea el rastreo de raíz — esto es una segunda capa, porque el
// robots.txt es solo una sugerencia que un buscador podría ignorar.
export const metadata = {
  title: "FM RRHH",
  robots: { index: false, follow: false, nocache: true },
};

// Aplica "menú achicado" ANTES de que se pinte la página — si se hiciera
// recién al cargar React, el contenido saltaría de lugar en cada pantalla.
const SCRIPT_MENU = `try{if(localStorage.getItem("fm-menu-colapsado")==="1")document.body.dataset.menu="colapsado"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "";
  // /terminal (kiosco) y /portal (empleado) manejan su propio marco; /login
  // (sin sesión) tampoco lleva menú.
  const conMenu = !rutaSinMenu(pathname) && (await obtenerSesionActual()) !== null;
  return (
    <html lang="es">
      <body className={conMenu ? "con-menu" : undefined} suppressHydrationWarning>
        {conMenu && <script dangerouslySetInnerHTML={{ __html: SCRIPT_MENU }} />}
        <Nav />
        <div className={conMenu ? "ml-contenido" : undefined} style={conMenu || rutaSinMenu(pathname) ? undefined : { padding: "1.5rem 2rem 2rem" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
