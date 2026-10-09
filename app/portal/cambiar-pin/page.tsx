import { obtenerSesionPortal } from "@/lib/portal";
import CambiarPinForm from "./CambiarPinForm";

export const dynamic = "force-dynamic";

export default async function CambiarPinPage() {
  const sesion = await obtenerSesionPortal();
  return <CambiarPinForm obligatorio={sesion?.debeCambiarPin ?? false} />;
}
