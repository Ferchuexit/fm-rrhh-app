"use client";
import { useEffect, useRef, useState } from "react";

type Msj = { id: string; autorId: string | null; autor: string; deRRHH: boolean; texto: string; borrado: boolean; cuando: string };
const TZ = "America/Argentina/Buenos_Aires";
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const diaClave = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
function diaTexto(iso: string) {
  const k = diaClave(iso);
  if (k === diaClave(new Date().toISOString())) return "Hoy";
  if (k === diaClave(new Date(Date.now() - 86400000).toISOString())) return "Ayer";
  return new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

export default function Hilo({ id, yo, grupo, inicial, noEscribe }: { id: string; yo: string; grupo: boolean; inicial: Msj[]; noEscribe: string | null }) {
  const [mensajes, setMensajes] = useState(inicial);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ultimo = useRef(inicial.length ? inicial[inicial.length - 1].cuando : null);
  const fin = useRef<HTMLDivElement>(null);

  const sumar = (nuevos: Msj[]) => {
    if (nuevos.length === 0) return;
    setMensajes((m) => { const ids = new Set(m.map((x) => x.id)); return [...m, ...nuevos.filter((x) => !ids.has(x.id))]; });
    ultimo.current = nuevos[nuevos.length - 1].cuando;
  };

  // Mientras la conversación está abierta y a la vista, se piden los
  // mensajes nuevos cada pocos segundos.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/portal/chat/${id}${ultimo.current ? `?desde=${encodeURIComponent(ultimo.current)}` : ""}`);
        if (res.status === 401) { window.location.href = "/portal/login"; return; }
        if (res.ok) sumar((await res.json()).mensajes);
      } catch { /* sin conexión: se reintenta */ }
    }, 4000);
    return () => clearInterval(t);
  }, [id]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [mensajes.length]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/chat/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: t }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "No se pudo enviar."); else { sumar([d.mensaje]); setTexto(""); }
    } catch { setError("No hay conexión. El mensaje no se envió."); }
    setEnviando(false);
  }
  async function borrar(m: Msj) {
    if (!window.confirm("¿Borrar este mensaje?")) return;
    const res = await fetch(`/api/portal/chat/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ borrar: m.id }) });
    if (res.ok) setMensajes((l) => l.map((x) => (x.id === m.id ? { ...x, borrado: true, texto: "" } : x)));
  }

  return (
    <>
      <div className="chat-hilo" aria-live="polite">
        {mensajes.length === 0 && <p className="p-sub" style={{ textAlign: "center", marginTop: "2rem" }}>Todavía no hay mensajes.</p>}
        {mensajes.map((m, i) => {
          const mio = m.autorId === yo;
          const otroDia = i === 0 || diaClave(mensajes[i - 1].cuando) !== diaClave(m.cuando);
          // El nombre se muestra en los grupos y cuando escribe RR.HH., una
          // vez por tanda de mensajes seguidos de la misma persona.
          const conAutor = !mio && (grupo || m.deRRHH) && (otroDia || mensajes[i - 1].autor !== m.autor);
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {otroDia && <span className="chat-dia">{diaTexto(m.cuando)}</span>}
              <div className={`chat-msj${mio ? " mio" : ""}${m.deRRHH ? " rrhh" : ""}${m.borrado ? " borrado" : ""}`}>
                {conAutor && <span className="autor">{m.autor}</span>}
                {m.borrado ? "Mensaje eliminado" : m.texto}
                <span className="hora">{hora(m.cuando)}{mio && !m.borrado && <button onClick={() => borrar(m)}>borrar</button>}</span>
              </div>
            </div>
          );
        })}
        <div ref={fin} />
      </div>
      <div className="chat-escribir">
        {noEscribe ? <div className="nota">{noEscribe}</div> : (
          <form onSubmit={enviar}>
            <textarea rows={1} value={texto} maxLength={2000} placeholder="Escribí un mensaje" aria-label="Mensaje" onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); enviar(); } }} />
            <button type="submit" disabled={enviando || !texto.trim()}>Enviar</button>
          </form>
        )}
        {error && <div className="nota" role="alert" style={{ color: "#8d2a2a" }}>{error}</div>}
      </div>
    </>
  );
}
