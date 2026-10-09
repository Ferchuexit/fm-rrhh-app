// FM RRHH — app/portal/recibos/[id]/page.tsx
// Un recibo: resumen legible en el celular, el PDF oficial, y la firma.
import { redirect, notFound } from "next/navigation";
import { armarDatosRecibo } from "@/lib/armar-recibo";
import { obtenerSesionPortal, liquidacionDelEmpleado, registrarVista } from "@/lib/portal";
import { pesos, fechaHora } from "../../formato";
import FirmaRecibo from "./FirmaRecibo";

export const dynamic = "force-dynamic";

export default async function ReciboPortal({ params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  const liq = await liquidacionDelEmpleado(params.id, sesion.legajoId);
  const datos = liq ? await armarDatosRecibo(liq.legajoId, liq.periodoId) : null;
  if (!liq || !datos) notFound();

  await registrarVista(liq.id, sesion.legajoId);

  const firma = liq.reciboDigital;
  const totalHaberes = datos.haberes.reduce((a, h) => a + h.importe, 0);
  const totalDeducciones = datos.deducciones.reduce((a, d) => a + d.importe, 0);

  return (
    <>
      <a className="p-link" href="/portal/recibos">← Mis recibos</a>
      <h1>{liq.periodo.nombre}</h1>
      <p className="p-sub">
        Legajo {datos.legajo.numero} · {datos.legajo.categoria} · Pago {datos.periodo.fechaPago}
      </p>

      <div className="p-card">
        <div className="p-neto-grande">
          <span>Neto a cobrar</span>
          <strong>{pesos(liq.neto)}</strong>
        </div>
      </div>

      <div className="p-card">
        <h2 style={{ marginTop: 0 }}>Haberes</h2>
        <table className="p-tabla">
          <tbody>
            {datos.haberes.map((h, i) => (
              <tr key={i}>
                <td>{h.nombre}{h.cant ? <span style={{ color: "#6b727b" }}> · {h.cant}</span> : null}</td>
                <td>{pesos(h.importe)}</td>
              </tr>
            ))}
            <tr className="total"><td>Total haberes</td><td>{pesos(totalHaberes)}</td></tr>
          </tbody>
        </table>

        <h2>Descuentos</h2>
        <table className="p-tabla">
          <tbody>
            {datos.deducciones.map((d, i) => (
              <tr key={i}>
                <td>{d.nombre}{d.pct ? <span style={{ color: "#6b727b" }}> · {d.pct}</span> : null}</td>
                <td>−{pesos(d.importe)}</td>
              </tr>
            ))}
            <tr className="total"><td>Total descuentos</td><td>−{pesos(totalDeducciones)}</td></tr>
          </tbody>
        </table>
      </div>

      <a className="p-btn sec" href={`/api/portal/recibos/${liq.id}/pdf`} target="_blank" rel="noopener">
        Ver el recibo completo (PDF)
      </a>

      <h2>Firma</h2>
      {firma?.firma ? (
        <div className={`p-aviso ${firma.firma === "conforme" ? "ok" : "error"}`}>
          <strong>{firma.firma === "conforme" ? "Firmaste este recibo en conformidad" : "Firmaste este recibo en disconformidad"}</strong>
          <br />
          {firma.firmadoEn ? fechaHora(firma.firmadoEn) : ""}
          {firma.observacion ? <><br />Tu observación: “{firma.observacion}”</> : null}
        </div>
      ) : (
        <FirmaRecibo liquidacionId={liq.id} />
      )}
    </>
  );
}
