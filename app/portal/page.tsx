// FM RRHH — app/portal/page.tsx
// Inicio del portal: los recibos del empleado, del más nuevo al más viejo.
import { redirect } from "next/navigation";
import { obtenerSesionPortal, recibosDelEmpleado } from "@/lib/portal";
import { pesos, fechaPeriodo, estadoFirma } from "./formato";

export const dynamic = "force-dynamic";

export default async function PortalInicio() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  const recibos = await recibosDelEmpleado(sesion.legajoId);
  const pendientes = recibos.filter((r) => !r.reciboDigital?.firma).length;

  return (
    <>
      <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>

      {recibos.length === 0 ? (
        <div className="p-aviso info">
          Todavía no hay recibos publicados. Cuando RR.HH. cierre una liquidación, tu recibo va a aparecer acá.
        </div>
      ) : pendientes > 0 ? (
        <div className="p-aviso pendiente">
          Tenés <strong>{pendientes} {pendientes === 1 ? "recibo" : "recibos"}</strong> para firmar.
        </div>
      ) : (
        <div className="p-aviso ok">Estás al día: todos tus recibos están firmados.</div>
      )}

      {recibos.length > 0 && <h2>Mis recibos</h2>}
      {recibos.map((r) => {
        const est = estadoFirma(r.reciboDigital?.firma);
        return (
          <a key={r.id} href={`/portal/recibos/${r.id}`} className="p-card">
            <div className="p-card-cuerpo">
              <div className="p-card-titulo">{r.periodo.nombre}</div>
              <div className="p-card-dato">
                Neto <span className="p-neto">{pesos(r.neto)}</span> · Pago {fechaPeriodo(r.periodo.fechaPago ?? r.periodo.fechaHasta)}
              </div>
              <div className="p-card-dato">
                <span className={`p-chip ${est.clase}`}>{est.texto}</span>
              </div>
            </div>
            <span className="p-flecha" aria-hidden="true">›</span>
          </a>
        );
      })}

      <a className="p-link" href="/portal/cambiar-pin">Cambiar mi PIN</a>
    </>
  );
}
