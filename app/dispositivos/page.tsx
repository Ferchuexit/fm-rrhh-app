"use client";
import { useState, useEffect } from "react";

// FM RRHH — app/dispositivos/page.tsx
// Fase 1 del Control de Asistencia — administrar terminales, sin
// biometría todavía (eso es Fase 3). Admin-only (ver middleware.ts).
export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [codigoRecienCreado, setCodigoRecienCreado] = useState<{ nombre: string; codigo: string } | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const res = await fetch("/api/dispositivos");
    setDispositivos(await res.json());
  }

  async function crear() {
    if (!nombre.trim()) {
      setError("Falta el nombre.");
      return;
    }
    setCreando(true);
    setError("");
    const res = await fetch("/api/dispositivos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, ubicacion }),
    });
    const data = await res.json();
    setCreando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setCodigoRecienCreado({ nombre: data.nombre, codigo: data.codigoVinculacion });
    setNombre("");
    setUbicacion("");
    cargar();
  }

  return (
    <main>
      <h1>Dispositivos — Control de Asistencia</h1>
      <p>
        Terminales instaladas en la ubicación de cada cliente (tablet, celular) que registran fichadas. Todavía sin
        reconocimiento facial/huella — esta es la base (Fase 1): alta, estado online/offline, vinculación.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "500px" }}>
        <h3 style={{ marginTop: 0 }}>Nueva terminal</h3>
        <div style={{ marginBottom: "0.5rem" }}>
          <input placeholder="Nombre (ej. Terminal Recepción)" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: "100%", padding: "0.4rem" }} />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <input placeholder="Ubicación (opcional, ej. Planta Garín)" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} style={{ width: "100%", padding: "0.4rem" }} />
        </div>
        <button onClick={crear} disabled={creando}>{creando ? "Creando..." : "Crear y generar código"}</button>
        {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{error}</p>}

        {codigoRecienCreado && (
          <div style={{ marginTop: "1rem", background: "#eaf5ef", border: "1px solid #2F6F5E", padding: "0.75rem", textAlign: "center" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
              "{codigoRecienCreado.nombre}" — ingresá este código en la terminal para vincularla (se puede usar una sola vez):
            </p>
            <div style={{ fontSize: "2rem", fontWeight: "bold", letterSpacing: "0.3em", fontFamily: "monospace" }}>{codigoRecienCreado.codigo}</div>
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Estado</th>
            <th>Nombre</th>
            <th>Ubicación</th>
            <th>Vinculado</th>
            <th>Última conexión</th>
            <th>Código (si no vinculó todavía)</th>
          </tr>
        </thead>
        <tbody>
          {dispositivos.map((d) => (
            <tr key={d.id}>
              <td>{d.online ? <span style={{ color: "#2F6F5E" }}>🟢 Online</span> : <span style={{ opacity: 0.5 }}>🔴 Offline</span>}</td>
              <td>{d.nombre}</td>
              <td>{d.ubicacion ?? "—"}</td>
              <td>{d.vinculado ? "✔ Sí" : "— No"}</td>
              <td>{d.ultimaConexion ? new Date(d.ultimaConexion).toLocaleString("es-AR") : "Nunca"}</td>
              <td>{!d.vinculado ? <code>{d.codigoVinculacion}</code> : <span style={{ opacity: 0.4 }}>—</span>}</td>
            </tr>
          ))}
          {dispositivos.length === 0 && (
            <tr>
              <td colSpan={6} style={{ opacity: 0.5, textAlign: "center" }}>Todavía no hay ninguna terminal creada.</td>
            </tr>
          )}
        </tbody>
      </table>

      <p style={{ marginTop: "1.5rem" }}>
        <a href="/fichadas" style={{ fontSize: "0.85rem" }}>Ver fichadas registradas →</a>
      </p>
    </main>
  );
}
