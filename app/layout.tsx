import "./globals.css";
import Nav from "./Nav";

export const metadata = { title: "FM RRHH" };

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
