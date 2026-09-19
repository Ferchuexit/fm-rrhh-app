"use client";
import { useState, useEffect } from "react";

// FM RRHH — app/fichadas/page.tsx
// Auditoría de fichadas (de reloj, manuales, o de terminal) con
// corrección manual — punto 8 del documento: la fichada original NUNCA se
// borra ni se pisa, la corrección queda registrada aparte.
export default function FichadasPage() {
  const [fichadas, setFichadas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [horaCorregida, setHoraCorregida] = useState("");
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [error, setError] = useState("");

  const [buscar, setBuscar] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [orden, setOrden] = useState<"fecha" | "legajo" | "apellido">("fecha");
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, desde, hasta, orden, mostrarAnuladas]);

  async function cargar() {
    setCargando(true);
    const params = new URLSearchParams();
    if (buscar.trim()) params.set("buscar", buscar.trim());
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    params.set("orden", orden);
    if (mostrarAnuladas) params.set("mostrarAnuladas", "1");
    const res = await fetch(`/api/fichadas?${params}`);
    setFichadas(await res.json());
    setCargando(false);
  }

  async function guardarCorreccion(id: string) {
    setError("");
    const res = await fetch(`/api/fichadas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horaCorregida, motivoCorreccion: motivo }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setCorrigiendo(null);
    setHoraCorregida("");
    setMotivo("");
    cargar();
  }

  async function anularFichada(id: string) {
    if (!motivoAnulacion.trim()) {
      setError("Hace falta indicar el motivo de la anulación.");
      return;
    }
    setError("");
    const res = await fetch(`/api/fichadas/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivoAnulacion }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setAnulando(null);
    setMotivoAnulacion("");
    cargar();
  }

  const ORIGEN_LABEL: Record<string, string> = { reloj: "Reloj (import)", manual: "Manual", terminal: "Terminal" };
  function origenTexto(f: any) {
    if (f.origen !== "terminal") return ORIGEN_LABEL[f.origen] ?? f.origen;
    if (f.nivelConfianza == null) return "Terminal";
    return f.nivelConfianza > 0 ? `Terminal (facial, ${Math.round(f.nivelConfianza * 100)}%)` : "Terminal (manual — excepción)";
  }

  return (
    <main>
      <h1>Fichadas</h1>
      <p>
        El dato crudo — una marca por vez. Para ver el resultado ya interpretado (presente/ausente/tarde), andá a{" "}
        <a href="/asistencia">/asistencia</a>. Acá se audita y, si hace falta, se corrige a mano sin perder el dato original.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        <input placeholder="Buscar legajo o apellido..." value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ padding: "0.4rem", width: "220px" }} />
        <label style={{ fontSize: "0.85rem" }}>
          Desde: <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label style={{ fontSize: "0.85rem" }}>
          Hasta: <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label style={{ fontSize: "0.85rem" }}>
          Ordenar por:{" "}
          <select value={orden} onChange={(e) => setOrden(e.target.value as any)}>
            <option value="fecha">Fecha</option>
            <option value="legajo">N° de legajo</option>
            <option value="apellido">Apellido</option>
          </select>
        </label>
        <label style={{ fontSize: "0.85rem" }}>
          <input type="checkbox" checked={mostrarAnuladas} onChange={(e) => setMostrarAnuladas(e.target.checked)} /> Mostrar anuladas
        </label>
      </div>

      {cargando ? (
        <p style={{ opacity: 0.6 }}>Cargando...</p>
      ) : (
        <table style={{ fontSize: "0.85rem" }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Legajo</th>
              <th>Origen</th>
              <th>Dispositivo</th>
              <th>Corrección</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fichadas.map((f) => (
              <tr key={f.id} style={f.anulada ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                <td>{new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                <td>{f.hora}</td>
                <td>{f.legajo.numeroLegajo} — {f.legajo.apellido}, {f.legajo.nombre}</td>
                <td>{origenTexto(f)}</td>
                <td>{f.dispositivo ? `${f.dispositivo.nombre} (${f.dispositivo.ubicacion ?? "s/ubicación"})` : "—"}</td>
                <td>
                  {f.anulada ? (
                    <span title={f.motivoAnulacion} style={{ textDecoration: "none", color: "#B23A3A" }}>
                      Anulada <span style={{ opacity: 0.6 }}>({f.anuladoPor?.nombre})</span>
                    </span>
                  ) : f.horaCorregida ? (
                    <span title={f.motivoCorreccion}>
                      → {f.horaCorregida} <span style={{ opacity: 0.5 }}>({f.corregidoPor?.nombre})</span>
                    </span>
                  ) : (
                    <span style={{ opacity: 0.3 }}>—</span>
                  )}
                </td>
                <td>
                  {f.anulada ? null : corrigiendo === f.id ? (
                    <span style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                      <input placeholder="HH:mm" value={horaCorregida} onChange={(e) => setHoraCorregida(e.target.value)} style={{ width: "70px" }} />
                      <input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ width: "140px" }} />
                      <button onClick={() => guardarCorreccion(f.id)}>OK</button>
                      <button onClick={() => setCorrigiendo(null)}>×</button>
                    </span>
                  ) : anulando === f.id ? (
                    <span style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                      <input placeholder="Motivo de la anulación" value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} style={{ width: "160px" }} />
                      <button onClick={() => anularFichada(f.id)} style={{ color: "#B23A3A" }}>Confirmar</button>
                      <button onClick={() => setAnulando(null)}>×</button>
                    </span>
                  ) : (
                    <span style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => { setCorrigiendo(f.id); setHoraCorregida(""); setMotivo(""); setError(""); }} style={{ fontSize: "0.8rem" }}>
                        Corregir
                      </button>
                      <button onClick={() => { setAnulando(f.id); setMotivoAnulacion(""); setError(""); }} style={{ fontSize: "0.8rem", color: "#B23A3A" }}>
                        Eliminar
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {fichadas.length === 0 && (
              <tr>
                <td colSpan={7} style={{ opacity: 0.5, textAlign: "center" }}>No hay fichadas todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
    </main>
  );
}
