import type { Metadata, Viewport } from "next";

// FM RRHH — app/terminal/layout.tsx
// El manifest y el theme-color solo aplican dentro de /terminal — el
// resto de FM Software (el panel de administración normal) no se vuelve
// "instalable", solo esta pantalla de kiosco.
export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FM Asistencia",
  },
};

export const viewport: Viewport = {
  themeColor: "#163A5C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
