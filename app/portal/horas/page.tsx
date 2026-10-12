// FM RRHH — app/portal/horas/page.tsx
// El banco de horas del empleado: su acuerdo (para leer y aceptar), cuántas
// horas tiene y cuándo vencen, sus movimientos, y el pedido para usarlas o
// cobrarlas. Es el "método de control" que pide el art. 197 bis LCT: el
// empleado ve en todo momento lo trabajado y lo disponible.
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { bancoDelEmpleado, textoHoras, TIPOS_MOVIMIENTO, EQUIVALENCIAS } from "@/lib/banco-horas";
import { fechaPeriodo } from "../formato";
import { Aceptar, Pedir } from "./Acciones";

export const dynamic = "force-dynamic";

const QUE: Record<string, string> = { ...TIPOS_MOVIMIENTO, pago: "Cobradas", compensacion: "Descanso", acreditacion: "Horas extra al banco" };

export default async function PortalHoras() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const hoy = hoyArgentina();
  const datos = await bancoDelEmpleado(sesion.legajoId, hoy);
  if (!datos) redirect("/portal");
  const pendientes = datos.movimientos.filter((m) => m.estado === "pendiente");
  const historial = datos.movimientos.filter((m) => m.estado !== "pendiente" && (m.minutos !== 0 || m.tipo === "pago_directo"));

  return (
    <>
      <h1>Mi banco de horas</h1>
      <p className="p-sub">Las horas extra que acumulás para tomarte francos o salir antes, en vez de cobrarlas.</p>

      {datos.sinFirmar.map((a) => (
        <div key={a.id} className="p-card" style={{ borderColor: "var(--verde)", borderWidth: 2 }}>
          <div className="p-card-titulo">Tenés un acuerdo para leer</div>
          <div className="p-card-dato">Desde el {fechaPeriodo(a.desde)}{a.hasta ? ` hasta el ${fechaPeriodo(a.hasta)}` : ""}.</div>
          <div className="p-card-dato">{EQUIVALENCIAS[a.equivalencia]}.{a.topeHoras ? ` Hasta ${a.topeHoras} h acumuladas.` : ""}{a.plazoDias ? ` Cada hora se usa dentro de los ${a.plazoDias} días; si no, se paga.` : ""}</div>
          <div className="p-card-dato">Hacer horas extra sigue siendo voluntario, y podés pedir cobrarlas cuando quieras. Si te vas de la empresa, lo que tengas se paga.</div>
          <a className="p-btn sec" style={{ marginTop: "0.7rem" }} href={`/api/portal/banco-horas/acuerdo/${a.id}`} target="_blank" rel="noopener">Leer el acuerdo completo</a>
          <Aceptar id={a.id} />
          <div className="p-card-dato" style={{ color: "#6b727b", fontSize: "0.8rem" }}>Es voluntario: si no estás de acuerdo, no lo aceptes y consultá a RR.HH.</div>
        </div>
      ))}

      <div className="p-card">
        <strong style={{ color: "var(--azul-oscuro)" }}>Tus horas</strong>
        <div className="p-saldo">
          <div className="dest"><strong>{textoHoras(Math.max(0, datos.disponible))}</strong>disponibles</div>
          <div><strong>{textoHoras(datos.porVencer)}</strong>vencen pronto</div>
          <div><strong>{textoHoras(datos.vencido)}</strong>vencidas (se pagan)</div>
        </div>
        {datos.lotes.length > 0 && (
          <div style={{ marginTop: "0.7rem", fontSize: "0.88rem" }}>
            {datos.lotes.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", padding: "0.3rem 0", borderBottom: "1px solid var(--gris-claro)" }}>
                <span>{textoHoras(l.restante)} del {fechaPeriodo(l.fecha)}</span>
                <span style={{ color: l.estado === "vencido" ? "#8d2a2a" : l.estado === "por_vencer" ? "#8a5413" : "#6b727b" }}>{l.vence ? `${l.estado === "vencido" ? "venció" : "vence"} el ${fechaPeriodo(l.vence)}` : ""}</span>
              </div>
            ))}
          </div>
        )}
        {pendientes.length > 0 && <p className="p-pie" style={{ marginBottom: 0 }}>Tenés {pendientes.length === 1 ? "un pedido esperando" : `${pendientes.length} pedidos esperando`} respuesta de RR.HH.</p>}
      </div>

      {datos.vigente && datos.disponible > 0 && <Pedir hoy={hoy.toISOString().slice(0, 10)} disponible={textoHoras(datos.disponible)} />}

      {pendientes.length > 0 && (
        <>
          <h2>Esperando respuesta</h2>
          <div className="p-card" style={{ padding: 0 }}>
            {pendientes.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", padding: "0.6rem 0.9rem", borderBottom: "1px solid var(--gris-claro)" }}>
                <span>{m.tipo === "pago" ? `Cobrar ${textoHoras(-m.minutos)}` : `Usar ${textoHoras(-m.minutos)} el ${fechaPeriodo(m.fecha)}`}</span>
                <span className="p-chip pendiente">Pendiente</span>
              </div>
            ))}
          </div>
        </>
      )}

      {historial.length > 0 && (
        <>
          <h2>Movimientos</h2>
          <div className="p-card" style={{ padding: 0 }}>
            {historial.slice(0, 60).map((m) => (
              <div key={m.id} style={{ padding: "0.55rem 0.9rem", borderBottom: "1px solid var(--gris-claro)", fontSize: "0.9rem", opacity: m.estado === "rechazado" ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem" }}>
                  <strong>{QUE[m.tipo] ?? m.tipo}{m.estado === "rechazado" ? " (no aprobado)" : ""}</strong>
                  <span className="p-neto">{m.minutos ? `${m.minutos > 0 ? "+" : ""}${textoHoras(m.minutos)}` : ""}</span>
                </div>
                <span style={{ display: "block", fontSize: "0.8rem", color: "#6b727b" }}>
                  {fechaPeriodo(m.fecha)}{m.minutosTrabajados ? ` · ${textoHoras(m.minutosTrabajados)} extra${m.recargo ? ` al ${m.recargo} %` : ""}` : ""}{m.motivo ? ` · ${m.motivo}` : ""}{m.estado === "rechazado" && m.motivoAnulacion ? ` · ${m.motivoAnulacion}` : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {datos.acuerdos.filter((a) => a.estado !== "sin_firmar").map((a) => (
        <a key={a.id} className="p-btn sec" href={`/api/portal/banco-horas/acuerdo/${a.id}`} target="_blank" rel="noopener">Mi acuerdo{a.estado === "terminado" ? " (terminado)" : ""}</a>
      ))}
      <p className="p-pie">Si algo no coincide con lo que trabajaste, avisale a RR.HH. por el chat. Las horas salen de tus fichadas.</p>
    </>
  );
}
