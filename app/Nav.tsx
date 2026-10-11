// FM RRHH — app/Nav.tsx
// Navegación del panel: barra superior fina (lo global: empresa, usuario,
// salir) + menú lateral con los módulos. Reemplaza a la barra de
// desplegables horizontales, que con 10+ categorías ya no entraba — ver
// docs/77-menu-lateral.md.
//
// Este archivo sigue siendo Server Component: lee la sesión y arma el menú
// según el rol. Lo interactivo (colapsar, grupo abierto, ítem activo,
// cajón en el celular) vive en MenuLateral.tsx, que recibe todo ya resuelto.
import EmpresaSelector from "./EmpresaSelector";
import MenuLateral from "./MenuLateral";
import { obtenerSesionActual } from "@/lib/auth";
import { menuFiltrado } from "@/lib/menu-estructura";
import { permisosActuales } from "@/lib/permisos-servidor";
import { headers } from "next/headers";

// Dónde NO va el menú del sistema: /terminal (kiosco de fichadas, corre sin
// sesión en una tablet del cliente) y /portal (empleado, con su propio
// encabezado). El pathname llega vía header — lo pone el middleware.
export function rutaSinMenu(pathname: string) {
  return pathname.startsWith("/terminal") || pathname === "/portal" || pathname.startsWith("/portal/") || pathname === "/empleos" || pathname.startsWith("/empleos/");
}

export default async function Nav() {
  const pathname = headers().get("x-pathname") ?? "";
  if (rutaSinMenu(pathname)) return null;

  const sesion = await obtenerSesionActual();
  if (!sesion) return null; // sin sesión solo se llega a /login, que trae su propio logo

  const acceso = await permisosActuales();
  if (!acceso) return null; // el usuario fue eliminado: el middleware le cierra la sesión en la próxima navegación

  return (
    <MenuLateral categorias={menuFiltrado(acceso.esAdmin, acceso.permisos)} usuario={{ nombre: sesion.nombre, rol: acceso.esAdmin ? "admin" : sesion.rol }}>
      <EmpresaSelector />
    </MenuLateral>
  );
}
