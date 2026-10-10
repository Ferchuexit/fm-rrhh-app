"use client";
// FM RRHH — app/noticias/page.tsx
// RR.HH. publica comunicados para los empleados y ve quién los leyó.
import { useEffect, useRef, useState } from "react";

type Noticia = {
  id: string; titulo: string; cuerpo: string; requiereAcuse: boolean; estado: "publicada" | "archivada"; publicadaEn: string; publicadaPor: string | null;
  adjuntoNombre: string | null; centroCosto: { nombre: string } | null; destinatarios: number; leyeron: number; acusaron: number;
};
type Persona = { numeroLegajo: number; apellido: string; nombre: string; tieneAcceso: boolean; leidaEn: string | null; acuseEn: string | null };

const cuando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const btnSec = { background: "white", color: "#163A5C", border: "1px solid #163A5C" } as const;
const chico = { padding: "0.35rem 0.7rem", fontSize: "0.8rem" } as const;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function NoticiasPage() {
  const [noticias, setNoticias] = useState<Noticia[] | null>(null);
  const [centros, setCentros] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState("");
  const [f, setF] = useState({ titulo: "", cuerpo: "", centroCostoId: "", requiereAcuse: false });
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [abierta, setAbierta] = useState("");
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  async function cargar() {
    const res = await fetch("/api/noticias");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida — mirá la terminal donde corre npm run dev." }));
    if (!res.ok || d.error) { setError(d.error ?? "No se pudo cargar."); return; }
    setNoticias(d.noticias);
  }
  useEffect(() => {
    cargar();
    fetch("/api/centros-costo").then((r) => r.json()).then((c) => setCentros(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    const destino = f.centroCostoId ? `el sector ${centros.find((c) => c.id === f.centroCostoId)?.nombre}` : "toda la empresa";
    if (!confirm(`Se publica para ${destino} y los empleados la ven enseguida en el portal. Una noticia publicada no se puede editar (sí archivar). ¿Publicar?`)) return;
    setError("");
    setPublicando(true);
    let adjuntoBase64: string | undefined;
    if (adjunto) {
      if (adjunto.size > 3 * 1024 * 1024) { setError("El adjunto pesa más de 3 MB — comprimilo o usá una imagen más chica."); setPublicando(false); return; }
      adjuntoBase64 = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(adjunto); });
    }
    const res = await fetch("/api/noticias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, adjuntoBase64, adjuntoNombre: adjunto?.name }) });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    setPublicando(false);
    if (!res.ok) { setError(d.error ?? "Error inesperado."); return; }
    setF({ titulo: "", cuerpo: "", centroCostoId: "", requiereAcuse: false });
    setAdjunto(null);
    cargar();
  }

  async function verDetalle(id: string) {
    if (abierta === id) { setAbierta(""); return; }
    setAbierta(id);
    setPersonas(null);
    const d = await fetch(`/api/noticias/${id}`).then((r) => r.json());
    setPersonas(d.personas ?? []);
  }

  async function cambiarEstado(n: Noticia, estado: "publicada" | "archivada") {
    if (estado === "archivada" && !confirm(`"${n.titulo}" deja de verse en el portal. Las lecturas y confirmaciones quedan guardadas. ¿Archivar?`)) return;
    const res = await fetch(`/api/noticias/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "No se pudo actualizar."); return; }
    cargar();
  }

  function exportar(n: Noticia) {
    const filas = [["Legajo", "Apellido", "Nombre", "Leída", "Confirmó lectura"], ...(personas ?? []).map((p) => [p.numeroLegajo, p.apellido, p.nombre, cuando(p.leidaEn), cuando(p.acuseEn)])];
    const csv = "﻿" + filas.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `lectura_${n.titulo.replace(/[^\w.-]+/g, "_").slice(0, 40)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const visibles = (noticias ?? []).filter((n) => verArchivadas || n.estado === "publicada");
  const archivadas = (noticias ?? []).filter((n) => n.estado === "archivada").length;

  return (
    <main>
      <h1>Noticias</h1>
      <p style={{ maxWidth: "820px" }}>
        Comunicados para los empleados. Los ven en el portal, con un globito de "sin leer". Si marcás <strong>requiere confirmación</strong>, cada uno
        tiene que tocar "Confirmo que la leí" y queda registrado con fecha y hora.
      </p>

      {error && <p style={{ color: "#B23A3A", background: "#f8e4e4", padding: "0.6rem 0.8rem", maxWidth: "900px" }}>{error}</p>}

      <form onSubmit={publicar} style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", maxWidth: "900px", marginBottom: "1.5rem" }}>
        <strong style={{ color: "#163A5C" }}>Publicar una noticia</strong>
        <label style={{ display: "block", marginTop: "0.6rem" }}>
          Título
          <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={120} required style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.2rem" }} />
        </label>
        <label style={{ display: "block", marginTop: "0.6rem" }}>
          Texto
          <textarea value={f.cuerpo} onChange={(e) => setF({ ...f, cuerpo: e.target.value })} rows={6} maxLength={5000} required style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.2rem" }} />
        </label>
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.7rem" }}>
          <label>
            Para:{" "}
            <select value={f.centroCostoId} onChange={(e) => setF({ ...f, centroCostoId: e.target.value })} style={{ padding: "0.4rem" }}>
              <option value="">Toda la empresa</option>
              {centros.map((c) => <option key={c.id} value={c.id}>Solo {c.nombre}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={f.requiereAcuse} onChange={(e) => setF({ ...f, requiereAcuse: e.target.checked })} /> Requiere confirmación de lectura</label>
          <span>
            <input ref={archivo} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setAdjunto(e.target.files?.[0] ?? null)} />
            <button type="button" style={{ ...chico, ...btnSec }} onClick={() => archivo.current?.click()}>{adjunto ? "Cambiar adjunto" : "Adjuntar imagen o PDF"}</button>
            {adjunto && <span style={{ fontSize: "0.82rem" }}> {adjunto.name} <button type="button" style={{ ...chico, ...btnSec, border: "none" }} onClick={() => { setAdjunto(null); if (archivo.current) archivo.current.value = ""; }}>quitar</button></span>}
          </span>
        </div>
        <button type="submit" disabled={publicando} style={{ marginTop: "0.9rem" }}>{publicando ? "Publicando…" : "Publicar"}</button>
      </form>

      <div style={{ display: "flex", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ margin: "0 0 0.6rem" }}>Publicadas</h2>
        {archivadas > 0 && <label style={{ fontSize: "0.88rem" }}><input type="checkbox" checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} /> Mostrar también las {archivadas} archivadas</label>}
      </div>
      {noticias === null && !error && <p>Cargando…</p>}
      {noticias !== null && visibles.length === 0 && <p>Todavía no publicaste ninguna noticia.</p>}

      {visibles.map((n) => {
        const esta = abierta === n.id;
        const meta = n.requiereAcuse ? n.acusaron : n.leyeron;
        return (
          <div key={n.id} style={{ background: "white", border: "1px solid #dfe4e8", borderLeft: `4px solid ${n.estado === "archivada" ? "#a0a6ad" : "#163A5C"}`, padding: "0.9rem 1rem", maxWidth: "900px", marginBottom: "0.7rem", opacity: n.estado === "archivada" ? 0.75 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <strong style={{ color: "#163A5C", fontSize: "1.02rem" }}>{n.titulo}</strong>
                {n.estado === "archivada" && <span style={{ color: "#6b727b" }}> · archivada</span>}
                <div style={{ fontSize: "0.8rem", color: "#6b727b", marginTop: "0.15rem" }}>
                  {cuando(n.publicadaEn)} · {n.centroCosto ? `Sector ${n.centroCosto.nombre}` : "Toda la empresa"}{n.requiereAcuse ? " · requiere confirmación" : ""}
                  {n.adjuntoNombre && <> · <a href={`/api/noticias/${n.id}/adjunto`} target="_blank" rel="noopener">adjunto</a></>}
                </div>
                <div style={{ fontSize: "0.9rem", marginTop: "0.4rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: esta ? "none" : "3.9em", overflow: "hidden" }}>{n.cuerpo}</div>
              </div>
              <div style={{ textAlign: "right", minWidth: "170px" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: meta === n.destinatarios && n.destinatarios > 0 ? "#2F6F5E" : "#163A5C" }}>{meta} / {n.destinatarios}</div>
                <div style={{ fontSize: "0.8rem" }}>{n.requiereAcuse ? "confirmaron" : "la leyeron"} ({pct(meta, n.destinatarios)}%)</div>
                {n.requiereAcuse && <div style={{ fontSize: "0.76rem", color: "#6b727b" }}>{n.leyeron} la abrieron</div>}
                <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                  <button style={{ ...chico, ...btnSec }} onClick={() => verDetalle(n.id)}>{esta ? "Cerrar" : "Quién la leyó"}</button>
                  <button style={{ ...chico, ...btnSec }} onClick={() => cambiarEstado(n, n.estado === "publicada" ? "archivada" : "publicada")}>{n.estado === "publicada" ? "Archivar" : "Volver a publicar"}</button>
                </div>
              </div>
            </div>

            {esta && (
              <div style={{ marginTop: "0.8rem", paddingTop: "0.8rem", borderTop: "1px solid #EEF1F4" }}>
                {personas === null ? <p>Cargando…</p> : (
                  <>
                    <button style={chico} onClick={() => exportar(n)}>⬇ Exportar constancia (Excel/CSV)</button>
                    <table style={{ marginTop: "0.6rem", maxWidth: "760px" }}>
                      <thead><tr><th>Legajo</th><th>Empleado</th><th>Leída</th>{n.requiereAcuse && <th>Confirmó</th>}</tr></thead>
                      <tbody>
                        {[...personas].sort((a, b) => Number(!!(n.requiereAcuse ? a.acuseEn : a.leidaEn)) - Number(!!(n.requiereAcuse ? b.acuseEn : b.leidaEn)) || a.numeroLegajo - b.numeroLegajo).map((p) => (
                          <tr key={p.numeroLegajo}>
                            <td>{p.numeroLegajo}</td>
                            <td>{p.apellido}, {p.nombre}{!p.tieneAcceso && <div style={{ fontSize: "0.75rem", color: "#B8752B" }}>sin acceso al portal</div>}</td>
                            <td>{p.leidaEn ? cuando(p.leidaEn) : <span style={{ color: "#B23A3A" }}>No</span>}</td>
                            {n.requiereAcuse && <td>{p.acuseEn ? cuando(p.acuseEn) : <span style={{ color: "#B23A3A" }}>No</span>}</td>}
                          </tr>
                        ))}
                        {personas.length === 0 && <tr><td colSpan={4}>No hay empleados activos en este sector.</td></tr>}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
