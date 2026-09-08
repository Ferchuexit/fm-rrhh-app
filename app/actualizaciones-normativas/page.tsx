"use client";
import { useState, useEffect } from "react";

const ICONO_ESTADO: Record<string, string> = { pendiente: "⚠", validada: "🔎", aplicada: "✔" };
const COLOR_ESTADO: Record<string, string> = { pendiente: "#B8752B", validada: "#2568B0", aplicada: "#2F6F5E" };
const ETIQUETA_ESTADO: Record<string, string> = { pendiente: "Pendiente de parametrización", validada: "Validada, falta aplicar", aplicada: "Aplicada" };

export default function ActualizacionesNormativasPage() {
  const [actualizaciones, setActualizaciones] = useState<any[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ norma: "", fecha: "", vigenciaDesde: "", fuente: "", queModifica: "", convenios: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function cargar() {
    fetch("/api/actualizaciones-normativas").then((r) => r.json()).then(setActualizaciones);
  }
  useEffect(cargar, []);

  async function guardar() {
    setError("");
    if (!form.norma.trim() || !form.fecha || !form.queModifica.trim()) {
      setError("Completá al menos norma, fecha, y qué modifica.");
      return;
    }
    setGuardando(true);
    const res = await fetch("/api/actualizaciones-normativas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) { setError(data.error); return; }
    setForm({ norma: "", fecha: "", vigenciaDesde: "", fuente: "", queModifica: "", convenios: "" });
    setMostrarForm(false);
    cargar();
  }

  async function cambiarEstado(id: string, estadoValidacion: string) {
    await fetch(`/api/actualizaciones-normativas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estadoValidacion }),
    });
    cargar();
  }

  async function borrar(id: string, norma: string) {
    if (!confirm(`¿Borrar el registro de "${norma}"? No se puede deshacer.`)) return;
    await fetch(`/api/actualizaciones-normativas/${id}`, { method: "DELETE" });
    cargar();
  }

  return (
    <main>
      <h1>Centro de Actualizaciones Normativas</h1>
      <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
        Bitácora de cada cambio de ley, CCT, o requisito de ARCA que se aplicó al sistema — para poder responder
        "¿cuándo y por qué cambió esto?" sin reconstruirlo de memoria.
      </p>

      <button onClick={() => setMostrarForm(!mostrarForm)} style={{ marginBottom: "1rem" }}>
        {mostrarForm ? "Cancelar" : "+ Registrar actualización"}
      </button>

      {mostrarForm && (
        <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "600px" }}>
          <div style={{ marginBottom: "0.6rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem" }}>Norma</label>
            <input value={form.norma} onChange={(e) => setForm({ ...form, norma: e.target.value })} placeholder='Ej: "Acta paritaria Comercio, agosto 2026"' style={{ width: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.8rem" }}>Fecha de la norma</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.8rem" }}>Vigente desde</label>
              <input type="date" value={form.vigenciaDesde} onChange={(e) => setForm({ ...form, vigenciaDesde: e.target.value })} style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ marginBottom: "0.6rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem" }}>Qué modifica</label>
            <textarea value={form.queModifica} onChange={(e) => setForm({ ...form, queModifica: e.target.value })} rows={2} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: "0.6rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem" }}>Convenios afectados</label>
            <input value={form.convenios} onChange={(e) => setForm({ ...form, convenios: e.target.value })} placeholder='Ej: "Comercio, Camioneros" o "General"' style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: "0.8rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem" }}>Fuente</label>
            <input value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} placeholder="Link o cita del documento oficial" style={{ width: "100%" }} />
          </div>
          <button onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Registrar"}</button>
          {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{error}</p>}
        </div>
      )}

      {actualizaciones.length === 0 && <p style={{ opacity: 0.6 }}>Todavía no hay ninguna actualización registrada.</p>}

      {actualizaciones.map((a) => (
        <div key={a.id} style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "0.8rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <strong>{a.norma}</strong>
              <span style={{ color: COLOR_ESTADO[a.estadoValidacion], marginLeft: "0.6rem", fontSize: "0.85rem" }}>
                {ICONO_ESTADO[a.estadoValidacion]} {ETIQUETA_ESTADO[a.estadoValidacion]}
              </span>
            </div>
            <button onClick={() => borrar(a.id, a.norma)} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A", fontSize: "0.7rem" }}>
              Borrar
            </button>
          </div>
          <p style={{ margin: "0.4rem 0", fontSize: "0.88rem" }}>{a.queModifica}</p>
          <p style={{ fontSize: "0.78rem", opacity: 0.6, margin: 0 }}>
            {new Date(a.fecha).toISOString().slice(0, 10)}
            {a.vigenciaDesde && ` · vigente desde ${new Date(a.vigenciaDesde).toISOString().slice(0, 10)}`}
            {a.convenios && ` · ${a.convenios}`}
            {a.fuente && <> · <a href={a.fuente} target="_blank" rel="noreferrer">fuente</a></>}
          </p>
          {a.aplicadaPor && (
            <p style={{ fontSize: "0.75rem", opacity: 0.5, margin: "0.2rem 0 0" }}>
              Aplicada por {a.aplicadaPor} el {new Date(a.fechaAplicacion).toLocaleString("es-AR")}
            </p>
          )}
          <div style={{ marginTop: "0.5rem" }}>
            {["pendiente", "validada", "aplicada"].map((estado) => (
              <button
                key={estado}
                onClick={() => cambiarEstado(a.id, estado)}
                disabled={a.estadoValidacion === estado}
                style={{
                  fontSize: "0.72rem", marginRight: "0.4rem", padding: "0.15rem 0.5rem",
                  background: a.estadoValidacion === estado ? COLOR_ESTADO[estado] : "white",
                  color: a.estadoValidacion === estado ? "white" : COLOR_ESTADO[estado],
                  border: `1px solid ${COLOR_ESTADO[estado]}`,
                }}
              >
                {ICONO_ESTADO[estado]} {ETIQUETA_ESTADO[estado]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
