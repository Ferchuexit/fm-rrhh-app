"use client";
// FM RRHH — app/publicaciones/page.tsx
// Las publicaciones del muro vistas por RR.HH.: publicar como empresa,
// aprobar lo pendiente y sacar lo que no corresponde.
import { useEffect, useState } from "react";

type Com = { id: string; autor: string; texto: string; oculto: boolean };
type Pub = { id: string; autor: string; deRRHH: boolean; texto: string; conFoto: boolean; pendiente: boolean; oculto: boolean; createdAt: string; meGusta: number; comentarios: Com[] };
type Datos = { conAprobacion: boolean; publicaciones: Pub[] };

const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "820px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.55rem", fontSize: "0.82rem" };
const cuando = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" });

export default function PublicacionesPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [errorNuevo, setErrorNuevo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ver, setVer] = useState<"todas" | "pendientes" | "ocultas">("todas");

  async function cargar() {
    const res = await fetch("/api/publicaciones");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  async function accion(cuerpo: Record<string, unknown>) {
    const res = await fetch("/api/publicaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se pudo guardar.");
    cargar();
  }
  async function publicar() {
    if (enviando) return;
    setEnviando(true);
    setErrorNuevo("");
    const form = new FormData();
    form.set("texto", texto);
    if (foto) form.set("foto", foto);
    const res = await fetch("/api/publicaciones", { method: "POST", body: form }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!res?.ok) { setErrorNuevo(d.error ?? "No se pudo publicar. Si la foto pesa más de 4 MB, probá con una más liviana."); return; }
    setTexto(""); setFoto(null);
    cargar();
  }

  const pendientes = datos?.publicaciones.filter((p) => p.pendiente).length ?? 0;
  const lista = (datos?.publicaciones ?? []).filter((p) => (ver === "todas" ? true : ver === "pendientes" ? p.pendiente : p.oculto));

  return (
    <main>
      <h1>Publicaciones del muro</h1>
      <p style={{ maxWidth: "860px" }}>
        En el muro del portal, además de los reconocimientos y los festejos, la gente comparte textos y fotos: el trabajo terminado, un logro del equipo, el asado.
        Acá publicás como empresa y moderás. Para comunicados formales que hay que leer sí o sí, usá <a href="/noticias">Noticias</a>.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && (
        <>
          <p style={{ fontSize: "0.92rem" }}>
            <label><input type="checkbox" checked={datos.conAprobacion} onChange={(e) => accion({ accion: "config", conAprobacion: e.target.checked })} style={{ marginRight: 5 }} />Revisar lo que publican los empleados antes de que salga</label>
            <span style={{ color: "#6b727b" }}> — si no, sale al momento y lo podés ocultar después.</span>
          </p>
          <div style={{ ...caja, borderLeft: "4px solid #163A5C" }}>
            <strong style={{ color: "#163A5C" }}>Publicar como empresa</strong>
            <textarea rows={3} maxLength={1500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Terminamos la obra de…" style={{ display: "block", width: "100%", marginTop: "0.5rem" }} />
            <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <label>Foto (opcional, hasta 4 MB) <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} key={foto ? "con" : "sin"} /></label>
              {foto && <span style={{ fontSize: "0.85rem" }}>{foto.name} <button onClick={() => setFoto(null)} style={{ ...btnSec, ...chico }}>Quitar</button></span>}
              <button onClick={publicar} disabled={enviando || (!foto && texto.trim().length < 3)}>{enviando ? "Publicando…" : "Publicar"}</button>
            </div>
            {errorNuevo && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorNuevo}</p>}
          </div>

          <p>
            {([["todas", `Todas (${datos.publicaciones.length})`], ["pendientes", `Esperan aprobación (${pendientes})`], ["ocultas", "Ocultas"]] as const).map(([k, n]) => <button key={k} onClick={() => setVer(k)} style={{ ...(ver === k ? {} : btnSec), ...chico, marginRight: 4, ...(k === "pendientes" && pendientes > 0 && ver !== k ? { borderColor: "#B23A3A", color: "#B23A3A" } : {}) }}>{n}</button>)}
          </p>
          {lista.length === 0 && <p style={{ color: "#6b727b" }}>Nada en esta lista.</p>}
          {lista.map((p) => (
            <div key={p.id} style={{ ...caja, borderLeft: `4px solid ${p.pendiente ? "#8a5413" : p.oculto ? "#B23A3A" : "#2F6F5E"}`, opacity: p.oculto ? 0.7 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", flexWrap: "wrap" }}>
                <div><strong>{p.autor}</strong>{p.deRRHH && <span style={{ color: "#6b727b" }}> (empresa)</span>} <span style={{ color: "#6b727b", fontSize: "0.85rem" }}>· {cuando(p.createdAt)} · ❤️ {p.meGusta} · 💬 {p.comentarios.length}</span>{p.pendiente && <strong style={{ color: "#8a5413" }}> · ESPERA APROBACIÓN</strong>}{p.oculto && <strong style={{ color: "#B23A3A" }}> · OCULTA</strong>}</div>
                <span style={{ display: "flex", gap: 4 }}>
                  {p.pendiente && <button onClick={() => accion({ accion: "aprobar", id: p.id })} style={chico}>Aprobar</button>}
                  <button onClick={() => accion({ accion: p.oculto ? "mostrar" : "ocultar", id: p.id })} style={{ ...btnSec, ...chico }}>{p.oculto ? "Volver a mostrar" : p.pendiente ? "No publicar" : "Ocultar"}</button>
                </span>
              </div>
              {p.texto && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "0.5rem 0 0" }}>{p.texto}</p>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.conFoto && <img src={`/api/publicaciones/${p.id}/foto`} alt={`Foto publicada por ${p.autor}`} loading="lazy" style={{ maxWidth: 360, maxHeight: 300, marginTop: "0.5rem", borderRadius: 6, display: "block" }} />}
              {p.comentarios.length > 0 && (
                <div style={{ marginTop: "0.6rem", borderTop: "1px solid #eef2f5", paddingTop: "0.4rem", fontSize: "0.88rem" }}>
                  {p.comentarios.map((c) => <div key={c.id} style={{ marginBottom: 3, opacity: c.oculto ? 0.55 : 1 }}><strong>{c.autor}:</strong> {c.texto} <button onClick={() => accion({ accion: c.oculto ? "mostrarComentario" : "ocultarComentario", id: c.id })} style={{ ...btnSec, ...chico, padding: "0 0.4rem", fontSize: "0.72rem" }}>{c.oculto ? "mostrar" : "ocultar"}</button></div>)}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </main>
  );
}
