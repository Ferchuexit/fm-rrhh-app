"use client";
import { useEffect, useState } from "react";

type Conv = { id: string; tipo: string; titulo: string; emoji: string; soloAnuncios: boolean; ultimo: string | null; ultimoEn: string | null; sinLeer: number };
type Companiero = { id: string; nombre: string; sector: string | null };

// "14:32" si fue hoy, "ayer", o "08/10".
function cuando(iso: string | null) {
  if (!iso) return "";
  const tz = "America/Argentina/Buenos_Aires";
  const d = new Date(iso), dia = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  if (dia(d) === dia(new Date())) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  if (dia(d) === dia(new Date(Date.now() - 86400000))) return "ayer";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: tz });
}

export default function Lista({ inicial, companieros }: { inicial: Conv[]; companieros: Companiero[] }) {
  const [convs, setConvs] = useState(inicial);
  const [nuevo, setNuevo] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState("");

  // La lista se refresca sola mientras está a la vista.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/portal/chat");
        if (res.status === 401) { window.location.href = "/portal/login"; return; }
        if (res.ok) setConvs((await res.json()).conversaciones);
      } catch { /* sin conexión: se reintenta en la próxima vuelta */ }
    }, 15000);
    return () => clearInterval(t);
  }, []);

  async function abrir(con: string) {
    setError("");
    try {
      const res = await fetch("/api/portal/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ con }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "No se pudo abrir."); else window.location.href = `/portal/chat/${d.id}`;
    } catch { setError("No hay conexión. Probá de nuevo."); }
  }

  // Desde el organigrama se llega con ?con=<persona>: se abre esa charla.
  useEffect(() => {
    const con = new URLSearchParams(window.location.search).get("con");
    if (con) abrir(con);
  }, []);

  const filtrados = companieros.filter((c) => c.nombre.toLowerCase().includes(buscar.trim().toLowerCase())).slice(0, 30);
  return (
    <>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.8rem" }}>
        <button className="p-btn chico" style={{ margin: 0 }} onClick={() => abrir("rrhh")}>Escribirle a RR.HH.</button>
        {companieros.length > 0 && <button className="p-btn chico sec" style={{ margin: 0 }} onClick={() => setNuevo(!nuevo)}>{nuevo ? "Cerrar" : "Escribirle a un compañero"}</button>}
      </div>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      {nuevo && (
        <div className="p-card">
          <label className="p-campo">Buscá por apellido<input value={buscar} onChange={(e) => setBuscar(e.target.value)} autoFocus /></label>
          {filtrados.map((c) => <button key={c.id} onClick={() => abrir(c.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "0.6rem 0.2rem", background: "none", border: 0, borderTop: "1px solid #eef2f5", fontSize: "0.95rem", cursor: "pointer" }}>{c.nombre}{c.sector && <span style={{ color: "#6b727b", fontSize: "0.8rem" }}> · {c.sector}</span>}</button>)}
          {filtrados.length === 0 && <p className="p-sub">No hay nadie con ese nombre.</p>}
        </div>
      )}
      {convs.length === 0 && <p className="p-sub">Todavía no tenés conversaciones. Si necesitás algo de RR.HH., escribiles desde acá.</p>}
      {convs.map((c) => (
        <a key={c.id} href={`/portal/chat/${c.id}`} className="chat-item">
          <span className="emoji" aria-hidden="true">{c.emoji}</span>
          <span className="medio">
            <span className="titulo">{c.titulo}</span>
            <span className="previa" style={{ display: "block", fontWeight: c.sinLeer > 0 ? 700 : 400 }}>{c.ultimo ?? (c.soloAnuncios ? "Grupo de anuncios" : "Sin mensajes todavía")}</span>
          </span>
          <span className="lado">{cuando(c.ultimoEn)}{c.sinLeer > 0 && <><br /><span className="cuenta" aria-label={`${c.sinLeer} sin leer`}>{c.sinLeer}</span></>}</span>
        </a>
      ))}
    </>
  );
}
