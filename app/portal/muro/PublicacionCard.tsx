"use client";
// Una publicación del muro: me gusta, comentarios, y borrar la propia.
import { useState } from "react";

type Comentario = { id: string; autorId: string | null; autor: string; texto: string };
export type Pub = { id: string; autorId: string | null; autor: string; deRRHH: boolean; texto: string; conFoto: boolean; pendiente: boolean; cuando: string; meGusta: number; puesto: boolean; comentarios: Comentario[] };

export default function PublicacionCard({ pub, yo }: { pub: Pub; yo: string }) {
  const [gusta, setGusta] = useState({ total: pub.meGusta, puesto: pub.puesto });
  const [comentarios, setComentarios] = useState(pub.comentarios);
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const [borrada, setBorrada] = useState(false);

  async function pedir(cuerpo: Record<string, unknown>) {
    const res = await fetch(`/api/portal/publicaciones/${pub.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (res.status === 401) { window.location.href = "/portal/login"; return null; }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "No se pudo guardar."); return null; }
    setError("");
    return d;
  }
  async function meGusta() {
    const antes = gusta;
    setGusta({ puesto: !gusta.puesto, total: gusta.total + (gusta.puesto ? -1 : 1) }); // se ve al instante
    const d = await pedir({ accion: "megusta" }).catch(() => null);
    setGusta(d ? { puesto: d.puesto, total: d.total } : antes);
  }
  async function comentar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    const d = await pedir({ comentario: texto }).catch(() => null);
    if (d) { setComentarios([...comentarios, d.comentario]); setTexto(""); }
  }
  async function borrar() {
    if (!window.confirm("¿Borrar esta publicación?")) return;
    if (await pedir({ accion: "borrar" })) setBorrada(true);
  }
  async function borrarComentario(c: Comentario) {
    if (await pedir({ accion: "borrarComentario", comentarioId: c.id })) setComentarios(comentarios.filter((x) => x.id !== c.id));
  }

  if (borrada) return null;
  const chip = (activo: boolean): React.CSSProperties => ({ padding: "0.3rem 0.7rem", borderRadius: 999, fontSize: "0.9rem", cursor: "pointer", border: activo ? "2px solid #163A5C" : "1px solid #b9c4cd", background: activo ? "#e8f0f6" : "#fff", color: "#12202e", fontWeight: activo ? 700 : 400 });
  return (
    <div className="p-card">
      <div className="p-card-titulo">{pub.deRRHH ? "🏭 " : ""}{pub.autor}</div>
      <div className="p-card-dato" style={{ color: "#6b727b" }}>{pub.cuando}{pub.pendiente && <> · <span className="p-chip pendiente">Esperando el visto bueno de RR.HH.</span></>}</div>
      {pub.texto && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "0.95rem", marginTop: "0.4rem" }}>{pub.texto}</div>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {pub.conFoto && <img src={`/api/portal/publicaciones/${pub.id}/foto`} alt={`Foto publicada por ${pub.autor}`} loading="lazy" style={{ width: "100%", borderRadius: 8, marginTop: "0.5rem", background: "#eef2f5" }} />}
      {!pub.pendiente && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", alignItems: "center" }}>
          <button onClick={meGusta} aria-pressed={gusta.puesto} style={chip(gusta.puesto)}>❤️ {gusta.total > 0 ? gusta.total : "Me gusta"}</button>
          <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto} style={chip(false)}>💬 {comentarios.length > 0 ? comentarios.length : "Comentar"}</button>
          {pub.autorId === yo && <button onClick={borrar} style={{ marginLeft: "auto", background: "none", border: 0, color: "#8d2a2a", textDecoration: "underline", fontSize: "0.8rem", cursor: "pointer" }}>Borrar</button>}
        </div>
      )}
      {pub.pendiente && pub.autorId === yo && <button onClick={borrar} className="p-btn chico rojo">Borrar</button>}
      {error && <div className="p-aviso error" role="alert" style={{ marginTop: "0.5rem" }}>{error}</div>}
      {abierto && (
        <div style={{ marginTop: "0.6rem", borderTop: "1px solid var(--gris-claro)", paddingTop: "0.5rem" }}>
          {comentarios.map((c) => (
            <div key={c.id} style={{ fontSize: "0.9rem", marginBottom: "0.4rem", overflowWrap: "anywhere" }}>
              <strong style={{ color: "var(--azul-oscuro)" }}>{c.autor}</strong> {c.texto}
              {c.autorId === yo && <button onClick={() => borrarComentario(c)} style={{ background: "none", border: 0, color: "#8d2a2a", textDecoration: "underline", fontSize: "0.72rem", marginLeft: 6, cursor: "pointer" }}>borrar</button>}
            </div>
          ))}
          <form onSubmit={comentar} style={{ display: "flex", gap: "0.4rem" }}>
            <input value={texto} maxLength={500} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí un comentario" aria-label="Comentario" style={{ flex: 1, minWidth: 0, padding: "0.55rem 0.7rem", fontSize: "0.95rem", border: "1px solid #b9c4cd", borderRadius: 18 }} />
            <button type="submit" disabled={!texto.trim()} style={{ padding: "0.5rem 0.9rem", borderRadius: 18, border: 0, background: "var(--azul-oscuro)", color: "#fff", fontWeight: 700 }}>Enviar</button>
          </form>
        </div>
      )}
    </div>
  );
}
