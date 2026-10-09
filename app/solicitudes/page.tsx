"use client";
// FM RRHH — app/solicitudes/page.tsx
// Bandeja de RR.HH.: pedidos de vacaciones y permisos que llegan desde el
// portal del empleado. Aprobar vacaciones las registra en /vacaciones.
import { useEffect, useState } from "react";

type Solicitud = {
  id: string; tipo: "vacaciones" | "permiso"; fechaDesde: string; fechaHasta: string; dias: number; motivo: string | null;
  estado: "pendiente" | "aprobada" | "rechazada" | "cancelada"; respuesta: string | null; resueltoPor: string | null; resueltoEn: string | null; createdAt: string;
  legajo: { numeroLegajo: number; apellido: string; nombre: string; centroCosto: { nombre: string } | null };
  saldo: { anio: number; corresponden: number; registrados: number; enTramite: number; disponibles: number } | null;
};

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const momento = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const COLOR: Record<string, string> = { pendiente: "#B8752B", aprobada: "#2F6F5E", rechazada: "#B23A3A", cancelada: "#6b727b" };

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [abierta, setAbierta] = useState<{ id: string; accion: "aprobar" | "rechazar" } | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [anio, setAnio] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verTodas, setVerTodas] = useState(false);

  async function cargar() {
    const d = await fetch("/api/solicitudes").then((r) => r.json());
    setSolicitudes(d.solicitudes ?? []);
  }
  useEffect(() => { cargar(); }, []);

  function abrir(s: Solicitud, accion: "aprobar" | "rechazar") {
    setAbierta({ id: s.id, accion });
    setRespuesta("");
    setAnio(s.fechaDesde.slice(0, 4));
    setError("");
  }

  async function responder() {
    if (!abierta) return;
    setEnviando(true);
    setError("");
    const res = await fetch(`/api/solicitudes/${abierta.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: abierta.accion, respuesta, anioCorresponde: anio }),
    });
    const data = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    setEnviando(false);
    if (!res.ok) {
      setError(data.error ?? "Error inesperado.");
      if (res.status === 409) cargar();
      return;
    }
    setAbierta(null);
    cargar();
  }

  const pendientes = (solicitudes ?? []).filter((s) => s.estado === "pendiente").sort((a, b) => a.fechaDesde.localeCompare(b.fechaDesde));
  const resueltas = (solicitudes ?? []).filter((s) => s.estado !== "pendiente");
  const btnSec = { background: "white", color: "#163A5C", border: "1px solid #163A5C" } as const;

  return (
    <main>
      <h1>Solicitudes de vacaciones y permisos</h1>
      <p style={{ maxWidth: "820px" }}>
        Pedidos que los empleados hacen desde el portal. Al <strong>aprobar vacaciones</strong>, quedan registradas en{" "}
        <a href="/vacaciones">Vacaciones</a> (Gantt, pendientes y notificación en PDF) sin volver a cargarlas. Aprobar un <strong>permiso</strong> solo
        deja la constancia: el código que corresponda en la grilla lo cargás en <a href="/asistencia">Asistencia</a>.
      </p>

      {solicitudes === null ? <p>Cargando…</p> : (
        <>
          <h2>Pendientes ({pendientes.length})</h2>
          {pendientes.length === 0 && <p>No hay pedidos esperando respuesta.</p>}
          {pendientes.map((s) => {
            const excede = s.saldo && s.dias > s.saldo.disponibles;
            const esta = abierta?.id === s.id;
            return (
              <div key={s.id} style={{ background: "white", border: "1px solid #dfe4e8", borderLeft: `4px solid ${COLOR.pendiente}`, padding: "0.9rem 1rem", maxWidth: "900px", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ color: "#163A5C" }}>#{s.legajo.numeroLegajo} {s.legajo.apellido}, {s.legajo.nombre}</strong>
                    {s.legajo.centroCosto && <span style={{ color: "#6b727b" }}> · {s.legajo.centroCosto.nombre}</span>}
                    <div style={{ marginTop: "0.25rem" }}>
                      <strong>{s.tipo === "vacaciones" ? "Vacaciones" : "Permiso"}</strong> · {dia(s.fechaDesde)}{s.dias > 1 ? ` al ${dia(s.fechaHasta)}` : ""} · {s.dias} {s.dias === 1 ? "día" : "días"}
                    </div>
                    {s.motivo && <div style={{ fontSize: "0.9rem", marginTop: "0.2rem" }}>“{s.motivo}”</div>}
                    {s.saldo && (
                      <div style={{ fontSize: "0.85rem", marginTop: "0.3rem", color: excede ? "#B23A3A" : "#4A4F58" }}>
                        Saldo {s.saldo.anio} sin contar este pedido: {s.saldo.disponibles} disponibles ({s.saldo.corresponden} corresponden, {s.saldo.registrados} registrados{s.saldo.enTramite ? `, ${s.saldo.enTramite} en otros pedidos` : ""})
                        {excede ? " — este pedido lo excede" : ""}
                      </div>
                    )}
                    <div style={{ fontSize: "0.78rem", color: "#6b727b", marginTop: "0.2rem" }}>Pedido el {momento(s.createdAt)}</div>
                  </div>
                  {!esta && (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                      <button onClick={() => abrir(s, "aprobar")}>Aprobar</button>
                      <button onClick={() => abrir(s, "rechazar")} style={btnSec}>Rechazar</button>
                    </div>
                  )}
                </div>

                {esta && (
                  <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #EEF1F4" }}>
                    {abierta!.accion === "aprobar" && s.tipo === "vacaciones" && (
                      <label style={{ display: "block", marginBottom: "0.5rem" }}>
                        Año al que corresponden los días:{" "}
                        <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} style={{ width: "90px", padding: "0.35rem" }} />
                      </label>
                    )}
                    <label style={{ display: "block" }}>
                      {abierta!.accion === "rechazar" ? "Motivo del rechazo (lo lee el empleado)" : "Comentario para el empleado (opcional)"}
                      <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={2} maxLength={500} style={{ display: "block", width: "100%", maxWidth: "560px", padding: "0.5rem", marginTop: "0.25rem" }} />
                    </label>
                    {error && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{error}</p>}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                      <button onClick={responder} disabled={enviando} style={abierta!.accion === "rechazar" ? { background: "#B23A3A" } : undefined}>
                        {enviando ? "Guardando…" : abierta!.accion === "aprobar" ? "Confirmar aprobación" : "Confirmar rechazo"}
                      </button>
                      <button onClick={() => setAbierta(null)} disabled={enviando} style={btnSec}>Volver</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <h2 style={{ marginTop: "2rem" }}>Respondidas ({resueltas.length})</h2>
          {resueltas.length > 0 && (
            <table style={{ maxWidth: "1100px" }}>
              <thead><tr><th>Legajo</th><th>Empleado</th><th>Pedido</th><th>Fechas</th><th>Estado</th><th>Respuesta</th></tr></thead>
              <tbody>
                {(verTodas ? resueltas : resueltas.slice(0, 20)).map((s) => (
                  <tr key={s.id}>
                    <td>{s.legajo.numeroLegajo}</td>
                    <td>{s.legajo.apellido}, {s.legajo.nombre}</td>
                    <td>{s.tipo === "vacaciones" ? "Vacaciones" : "Permiso"} · {s.dias} d.</td>
                    <td>{dia(s.fechaDesde)}{s.dias > 1 ? ` al ${dia(s.fechaHasta)}` : ""}</td>
                    <td>
                      <span style={{ color: COLOR[s.estado], fontWeight: 600 }}>{s.estado === "cancelada" ? "Cancelada por el empleado" : s.estado.charAt(0).toUpperCase() + s.estado.slice(1)}</span>
                      <div style={{ fontSize: "0.78rem", color: "#6b727b" }}>{momento(s.resueltoEn)}{s.resueltoPor ? ` · ${s.resueltoPor}` : ""}</div>
                    </td>
                    <td style={{ maxWidth: "300px" }}>{s.respuesta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!verTodas && resueltas.length > 20 && <p><button onClick={() => setVerTodas(true)} style={btnSec}>Ver las {resueltas.length}</button></p>}
        </>
      )}
    </main>
  );
}
