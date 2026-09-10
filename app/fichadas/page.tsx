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
  const [error, setError] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const res = await fetch("/api/fichadas");
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

  const ORIGEN_LABEL: Record<string, string> = { reloj: "Reloj (import)", manual: "Manual", terminal: "Terminal" };

  return (
    <main>
      <h1>Fichadas</h1>
      <p>
        El dato crudo — una marca por vez. Para ver el resultado ya interpretado (presente/ausente/tarde), andá a{" "}
        <a href="/asistencia">/asistencia</a>. Acá se audita y, si hace falta, se corrige a mano sin perder el dato original.
      </p>

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
              <tr key={f.id}>
                <td>{new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                <td>{f.hora}</td>
                <td>{f.legajo.numeroLegajo} — {f.legajo.apellido}, {f.legajo.nombre}</td>
                <td>{ORIGEN_LABEL[f.origen] ?? f.origen}</td>
                <td>{f.dispositivo ? `${f.dispositivo.nombre} (${f.dispositivo.ubicacion ?? "s/ubicación"})` : "—"}</td>
                <td>
                  {f.horaCorregida ? (
                    <span title={f.motivoCorreccion}>
                      → {f.horaCorregida} <span style={{ opacity: 0.5 }}>({f.corregidoPor?.nombre})</span>
                    </span>
                  ) : (
                    <span style={{ opacity: 0.3 }}>—</span>
                  )}
                </td>
                <td>
                  {corrigiendo === f.id ? (
                    <span style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                      <input placeholder="HH:mm" value={horaCorregida} onChange={(e) => setHoraCorregida(e.target.value)} style={{ width: "70px" }} />
                      <input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ width: "140px" }} />
                      <button onClick={() => guardarCorreccion(f.id)}>OK</button>
                      <button onClick={() => setCorrigiendo(null)}>×</button>
                    </span>
                  ) : (
                    <button onClick={() => { setCorrigiendo(f.id); setHoraCorregida(""); setMotivo(""); setError(""); }} style={{ fontSize: "0.8rem" }}>
                      Corregir
                    </button>
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
