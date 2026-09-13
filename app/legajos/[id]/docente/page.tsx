"use client";
import { useState, useEffect } from "react";

// FM RRHH — app/legajos/[id]/docente/page.tsx
// Fase 1 (Maestro de Grado + Preceptor, Primaria, Jornada Completa) —
// ver el motor en lib/motor/motor-docentes-pba.mjs para el alcance
// exacto y qué queda pendiente.
export default function DocentePage({ params }: { params: { id: string } }) {
  const [perfil, setPerfil] = useState<any>(null);
  const [cargos, setCargos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [antiguedadInput, setAntiguedadInput] = useState("0");
  const [guardandoAntiguedad, setGuardandoAntiguedad] = useState(false);

  const [nuevoCargoId, setNuevoCargoId] = useState("");
  const [nuevoEstablecimiento, setNuevoEstablecimiento] = useState("");
  const [nuevaZonaRural, setNuevaZonaRural] = useState(false);
  const [nuevaFechaAlta, setNuevaFechaAlta] = useState(() => new Date().toISOString().slice(0, 10));
  const [agregando, setAgregando] = useState(false);

  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  });
  const [liquidando, setLiquidando] = useState(false);
  const [recibo, setRecibo] = useState<any>(null);
  const [errorLiquidar, setErrorLiquidar] = useState("");

  useEffect(() => {
    cargar();
    fetch("/api/docente-cargos").then((r) => r.json()).then(setCargos);
  }, []);

  async function cargar() {
    setCargando(true);
    const res = await fetch(`/api/legajos/${params.id}/docente-perfil`);
    const data = await res.json();
    setPerfil(data);
    if (data) setAntiguedadInput(String(data.antiguedadAnios));
    setCargando(false);
  }

  async function guardarAntiguedad() {
    setGuardandoAntiguedad(true);
    setError("");
    const res = await fetch(`/api/legajos/${params.id}/docente-perfil`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ antiguedadAnios: Number(antiguedadInput) }),
    });
    const data = await res.json();
    setGuardandoAntiguedad(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    cargar();
  }

  async function agregarDesignacion() {
    if (!nuevoCargoId) {
      setError("Elegí un cargo del nomenclador.");
      return;
    }
    setAgregando(true);
    setError("");
    const res = await fetch(`/api/legajos/${params.id}/docente-designaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docCargoId: nuevoCargoId, establecimiento: nuevoEstablecimiento, zonaRural: nuevaZonaRural, fechaAlta: nuevaFechaAlta }),
    });
    const data = await res.json();
    setAgregando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNuevoCargoId("");
    setNuevoEstablecimiento("");
    setNuevaZonaRural(false);
    cargar();
  }

  async function darDeBaja(designacionId: string) {
    if (!confirm("¿Dar de baja esta designación? Queda en el historial, no se borra.")) return;
    await fetch(`/api/docente-designaciones/${designacionId}`, { method: "DELETE" });
    cargar();
  }

  async function liquidar() {
    setLiquidando(true);
    setErrorLiquidar("");
    setRecibo(null);
    const res = await fetch(`/api/legajos/${params.id}/docente-liquidar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodo }),
    });
    const data = await res.json();
    setLiquidando(false);
    if (!res.ok) {
      setErrorLiquidar(data.error);
      return;
    }
    verRecibo();
  }

  async function verRecibo() {
    const res = await fetch(`/api/legajos/${params.id}/docente-liquidaciones/${periodo}`);
    const data = await res.json();
    setRecibo(data);
  }

  if (cargando) return <main><p style={{ opacity: 0.6 }}>Cargando...</p></main>;

  return (
    <main>
      <h1>Docente PBA</h1>
      <p style={{ fontSize: "0.85rem" }}>
        <a href={`/legajos/${params.id}/editar`}>← Volver al legajo</a>
      </p>
      <div style={{ background: "#fdf2ea", border: "1px solid #B8752B", padding: "0.6rem", maxWidth: "700px", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
        Fase 1 — Maestro de Grado y Preceptor, Primaria (Jornada Completa y Extendida, las dos resueltas). GARANTÍA no está implementada (mueve centavos). Ver detalle en <code>motor-docentes-pba.mjs</code>.
      </div>

      {/* ── Antigüedad ── */}
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", maxWidth: "500px", marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Antigüedad docente</h3>
        <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>Del docente en general (Art. 34) — no de una designación puntual.</p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="number" min="0" value={antiguedadInput} onChange={(e) => setAntiguedadInput(e.target.value)} style={{ width: "80px" }} />
          <span>años</span>
          <button onClick={guardarAntiguedad} disabled={guardandoAntiguedad}>{guardandoAntiguedad ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>

      {/* ── Designaciones ── */}
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", maxWidth: "700px", marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Designaciones activas</h3>
        <table style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
          <thead>
            <tr><th>Cargo</th><th>Modalidad</th><th>Establecimiento</th><th>Rural</th><th>Desde</th><th></th></tr>
          </thead>
          <tbody>
            {(perfil?.designaciones ?? []).map((d: any) => (
              <tr key={d.id}>
                <td>{d.docCargo.nombre}</td>
                <td>{d.docCargo.modalidad}</td>
                <td>{d.establecimiento ?? "—"}</td>
                <td>{d.zonaRural ? "Sí" : "—"}</td>
                <td>{new Date(d.fechaAlta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                <td><button onClick={() => darDeBaja(d.id)} style={{ fontSize: "0.75rem", color: "#B23A3A" }}>Dar de baja</button></td>
              </tr>
            ))}
            {(!perfil || perfil.designaciones.length === 0) && (
              <tr><td colSpan={6} style={{ opacity: 0.5, textAlign: "center" }}>Sin designaciones todavía.</td></tr>
            )}
          </tbody>
        </table>

        <h4>Agregar designación</h4>
        <div style={{ display: "grid", gap: "0.5rem", maxWidth: "420px" }}>
          <select value={nuevoCargoId} onChange={(e) => setNuevoCargoId(e.target.value)}>
            <option value="">Elegí un cargo...</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} — {c.nivel} — {c.modalidad}</option>
            ))}
          </select>
          <input placeholder="Establecimiento (opcional)" value={nuevoEstablecimiento} onChange={(e) => setNuevoEstablecimiento(e.target.value)} />
          <label style={{ fontSize: "0.85rem" }}>
            <input type="checkbox" checked={nuevaZonaRural} onChange={(e) => setNuevaZonaRural(e.target.checked)} /> Zona rural (+30%)
          </label>
          <label style={{ fontSize: "0.85rem" }}>
            Fecha de alta: <input type="date" value={nuevaFechaAlta} onChange={(e) => setNuevaFechaAlta(e.target.value)} />
          </label>
          <button onClick={agregarDesignacion} disabled={agregando}>{agregando ? "Agregando..." : "Agregar designación"}</button>
        </div>
        {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
      </div>

      {/* ── Liquidar ── */}
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", maxWidth: "700px" }}>
        <h3 style={{ marginTop: 0 }}>Liquidar</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
          <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          <button onClick={liquidar} disabled={liquidando}>{liquidando ? "Liquidando..." : "Liquidar este período"}</button>
          <button onClick={verRecibo} style={{ fontSize: "0.85rem" }}>Ver recibo ya generado</button>
        </div>
        {errorLiquidar && <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{errorLiquidar}</p>}

        {recibo && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: "1rem" }}>
            <h4>Recibo — {recibo.periodo}</h4>
            {recibo.designaciones?.map((d: any) => (
              <div key={d.designacionId} style={{ marginBottom: "1rem", background: "#f8f9fc", padding: "0.75rem", borderRadius: "6px" }}>
                <strong>{d.cargo}</strong> — {d.nivel} — {d.modalidad}
                <table style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
                  <tbody>
                    {d.detalle.map((linea: any) => (
                      <tr key={linea.codigo}>
                        <td>{linea.codigo}</td>
                        <td>{linea.nombre}</td>
                        <td style={{ textAlign: "right", color: linea.tipo === "descuento" ? "#B23A3A" : "inherit" }}>
                          {linea.importe.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ textAlign: "right", fontWeight: 600, marginTop: "0.4rem" }}>
                  Bolsillo: {d.bolsillo.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                </p>
              </div>
            ))}
            <p style={{ textAlign: "right", fontSize: "1.1rem", fontWeight: 700 }}>
              TOTAL: {recibo.totalBolsillo?.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
