// FM RRHH — app/portal/noticias/page.tsx
// Las noticias que le corresponden al empleado (toda la empresa + su sector).
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { noticiasDelEmpleado, resumenCuerpo } from "@/lib/noticias";
import { fechaHora } from "../formato";

export const dynamic = "force-dynamic";

export default async function PortalNoticias() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const noticias = await noticiasDelEmpleado(sesion.legajoId);

  return (
    <>
      <h1>Noticias</h1>
      {noticias.length === 0 && <div className="p-aviso info">Todavía no hay noticias publicadas.</div>}
      {noticias.map((n) => (
        <a key={n.id} href={`/portal/noticias/${n.id}`} className={`p-card p-noticia${n.estado === "nueva" ? " nueva" : ""}`}>
          <div className="p-card-cuerpo">
            <div className="p-card-titulo">{n.estado === "nueva" && <span className="p-punto" aria-label="Sin leer" />}{n.titulo}</div>
            <div className="p-card-dato">{resumenCuerpo(n.cuerpo)}</div>
            <div className="p-card-dato" style={{ color: "#6b727b", fontSize: "0.78rem" }}>
              {fechaHora(n.publicadaEn)}{n.adjuntoMime ? " · con adjunto" : ""}
              {n.estado === "falta_acuse" || (n.estado === "nueva" && n.requiereAcuse) ? <> · <span className="p-chip pendiente">Pide confirmación</span></> : null}
              {n.requiereAcuse && n.estado === "al_dia" ? <> · <span className="p-chip conforme">Confirmada</span></> : null}
            </div>
          </div>
          <span className="p-flecha" aria-hidden="true">›</span>
        </a>
      ))}
    </>
  );
}
