"use client";
// FM RRHH — app/biblioteca/page.tsx
// La Librería de conocimiento del lado de RR.HH.: cargar artículos (texto,
// archivo o enlace), publicarlos, y ver cuánta gente los abrió.
import { useEffect, useState } from "react";
import { ESTADOS_ARTICULO, emojiDeCategoria } from "@/lib/biblioteca-reglas";

type Articulo = { id: string; titulo: string; categoria: string; contenido: string | null; enlace: string | null; archivoNombre: string | null; archivoMime: string | null; centroCostoIds: string[]; destacado: boolean; estado: string; actualizadoEn: string; lecturas: number; destinatarios: number };
type Datos = { sectores: { id: string; nombre: string }[]; sugeridas: { nombre: string; emoji: string; ejemplos: string }[]; articulos: Articulo[] };
type Form = { id: string; titulo: string; categoria: string; contenido: string; enlace: string; centroCostoIds: string[]; destacado: boolean; archivoActual: string | null; quitarArchivo: boolean };
type Persona = { id: string; nombre: string; sector: string; leidoEn: string | null };

const VACIO: Form = { id: "", titulo: "", categoria: "", contenido: "", enlace: "", centroCostoIds: [], destacado: false, archivoActual: null, quitarArchivo: false };
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "980px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.55rem", fontSize: "0.82rem" };
const COLOR: Record<string, string> = { borrador: "#8a5413", publicado: "#2F6F5E", archivado: "#6b727b" };
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

export default function BibliotecaPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [lectores, setLectores] = useState<{ id: string; personas: Persona[] } | null>(null);

  async function cargar() {
    const res = await fetch("/api/biblioteca");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  const abrirForm = (f: Form) => { setErrorForm(""); setArchivo(null); setForm(f); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const editar = (a: Articulo) => abrirForm({ id: a.id, titulo: a.titulo, categoria: a.categoria, contenido: a.contenido ?? "", enlace: a.enlace ?? "", centroCostoIds: a.centroCostoIds, destacado: a.destacado, archivoActual: a.archivoNombre, quitarArchivo: false });

  async function guardar() {
    if (!form || guardando) return;
    setGuardando(true);
    setErrorForm("");
    const fd = new FormData();
    for (const k of ["id", "titulo", "categoria", "contenido", "enlace"] as const) fd.set(k, form[k]);
    fd.set("centroCostoIds", form.centroCostoIds.join(","));
    fd.set("destacado", String(form.destacado));
    fd.set("quitarArchivo", String(form.quitarArchivo));
    if (archivo) fd.set("archivo", archivo);
    const res = await fetch("/api/biblioteca", { method: "POST", body: fd }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setGuardando(false);
    if (!res?.ok) { setErrorForm(d.error ?? "No se pudo guardar. Si el archivo pesa más de 4 MB, probá con uno más liviano."); return; }
    setMsg(form.id ? "Cambios guardados." : "Guardado como borrador. Cuando esté listo, publicalo para que se vea en el portal.");
    setForm(null);
    cargar();
  }
  async function accion(a: Articulo, cuerpo: Record<string, unknown> | "borrar", ok: string | ((d: any) => string), confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setMsg(""); setError("");
    const res = cuerpo === "borrar" ? await fetch(`/api/biblioteca/${a.id}`, { method: "DELETE" }) : await fetch(`/api/biblioteca/${a.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setError(d.error ?? "No se pudo completar."); else setMsg(typeof ok === "string" ? ok : ok(d));
    cargar();
  }
  function publicar(a: Articulo) {
    const avisar = window.confirm(`Se publica "${a.titulo}" en el portal.\n\n¿Además les avisamos a las ${a.destinatarios} personas que lo pueden ver?\n\nAceptar = publicar y avisar · Cancelar = publicar sin avisar`);
    accion(a, { accion: "publicar", avisar }, (d) => (avisar ? `Publicado. Se le avisó a ${d.avisados} ${d.avisados === 1 ? "persona" : "personas"} con acceso al portal.` : "Publicado, sin aviso."));
  }
  async function verLectores(a: Articulo) {
    if (lectores?.id === a.id) { setLectores(null); return; }
    const res = await fetch(`/api/biblioteca/${a.id}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setLectores({ id: a.id, personas: d.personas }); else setError(d.error ?? "No se pudo cargar.");
  }

  const categorias = [...new Set([...(datos?.articulos.map((a) => a.categoria) ?? []), ...(datos?.sugeridas.map((s) => s.nombre) ?? [])])];
  const usadas = [...new Set(datos?.articulos.map((a) => a.categoria) ?? [])];
  const lista = (datos?.articulos ?? []).filter((a) => !filtro || a.categoria === filtro);
  const sectoresDe = (a: Articulo) => (a.centroCostoIds.length === 0 ? "Toda la empresa" : a.centroCostoIds.map((id) => datos?.sectores.find((s) => s.id === id)?.nombre ?? "?").join(", "));

  return (
    <main>
      <h1>Librería de conocimiento</h1>
      <p style={{ maxWidth: "880px" }}>
        Lo que la gente tiene que poder consultar cuando lo necesita, desde el celular: el reglamento, un procedimiento de seguridad, el instructivo de una máquina, una pregunta frecuente.
        Cada artículo puede ser un texto, un archivo (PDF o imagen), un enlace a un video, o las tres cosas. El buscador del portal encuentra también lo que dicen los PDF por dentro.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {msg && <p style={{ color: "#2F6F5E" }}>{msg}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && !form && <p><button onClick={() => abrirForm({ ...VACIO })}>Nuevo artículo</button></p>}

      {datos && form && (
        <div style={{ ...caja, borderLeft: "4px solid #163A5C" }}>
          <strong style={{ color: "#163A5C" }}>{form.id ? "Editar artículo" : "Nuevo artículo"}</strong>
          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <label style={{ flex: "2 1 320px" }}>Título<br /><input value={form.titulo} maxLength={120} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Cómo pedir vacaciones" style={{ width: "100%" }} /></label>
            <label style={{ flex: "1 1 220px" }}>Categoría<br /><input list="categorias" value={form.categoria} maxLength={50} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Elegí o escribí una" style={{ width: "100%" }} /><datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist></label>
          </div>
          <label style={{ display: "block", marginTop: "0.6rem" }}>Texto <span style={{ color: "#6b727b" }}>(opcional si subís un archivo; conviene escribir al menos un resumen: se lee mejor en el celular que un PDF)</span><br /><textarea rows={8} maxLength={20000} value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} style={{ width: "100%" }} /></label>
          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.6rem", alignItems: "flex-end" }}>
            <label>Archivo <span style={{ color: "#6b727b" }}>(PDF o imagen, hasta 4 MB)</span><br /><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setForm({ ...form, quitarArchivo: false }); }} /></label>
            {form.archivoActual && !archivo && <span style={{ fontSize: "0.88rem" }}>{form.quitarArchivo ? <em>Se quita "{form.archivoActual}" al guardar</em> : <>Tiene: <a href={`/api/biblioteca/${form.id}/archivo`} target="_blank" rel="noopener">{form.archivoActual}</a></>} <button onClick={() => setForm({ ...form, quitarArchivo: !form.quitarArchivo })} style={{ ...btnSec, ...chico }}>{form.quitarArchivo ? "Dejarlo" : "Quitar"}</button></span>}
          </div>
          <label style={{ display: "block", marginTop: "0.6rem" }}>Enlace <span style={{ color: "#6b727b" }}>(opcional: un video de YouTube se ve dentro del portal)</span><br /><input value={form.enlace} maxLength={500} onChange={(e) => setForm({ ...form, enlace: e.target.value })} placeholder="https://…" style={{ width: "100%", maxWidth: 600 }} /></label>
          <div style={{ marginTop: "0.7rem" }}>
            <strong>Quiénes lo ven:</strong>{" "}
            <label style={{ marginRight: 12 }}><input type="checkbox" checked={form.centroCostoIds.length === 0} onChange={() => setForm({ ...form, centroCostoIds: [] })} style={{ marginRight: 4 }} />Toda la empresa</label>
            {datos.sectores.map((s) => <label key={s.id} style={{ marginRight: 12 }}><input type="checkbox" checked={form.centroCostoIds.includes(s.id)} onChange={(e) => setForm({ ...form, centroCostoIds: e.target.checked ? [...form.centroCostoIds, s.id] : form.centroCostoIds.filter((x) => x !== s.id) })} style={{ marginRight: 4 }} />{s.nombre}</label>)}
          </div>
          <label style={{ display: "block", marginTop: "0.5rem" }}><input type="checkbox" checked={form.destacado} onChange={(e) => setForm({ ...form, destacado: e.target.checked })} style={{ marginRight: 4 }} />Destacado <span style={{ color: "#6b727b" }}>— aparece arriba de todo, en "Lo más importante"</span></label>
          {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}><button onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Guardar borrador"}</button><button onClick={() => setForm(null)} style={btnSec} disabled={guardando}>Cancelar</button></div>
        </div>
      )}

      {datos && datos.articulos.length === 0 && !form && (
        <div style={caja}>
          <strong style={{ color: "#163A5C" }}>¿Por dónde empezar?</strong>
          <p style={{ margin: "0.3rem 0 0.6rem" }}>Con lo que la gente pregunta siempre. Estas son las categorías que casi toda fábrica termina usando; tocá una para cargar el primer artículo.</p>
          <table><tbody>
            {datos.sugeridas.map((s) => <tr key={s.nombre}><td style={{ whiteSpace: "nowrap" }}><button onClick={() => abrirForm({ ...VACIO, categoria: s.nombre })} style={{ ...btnSec, ...chico }}>{s.emoji} {s.nombre}</button></td><td style={{ color: "#4A4F58", fontSize: "0.9rem" }}>{s.ejemplos}</td></tr>)}
          </tbody></table>
        </div>
      )}

      {datos && datos.articulos.length > 0 && (
        <>
          <p>
            <button onClick={() => setFiltro("")} style={{ ...(filtro ? btnSec : {}), ...chico, marginRight: 4 }}>Todas ({datos.articulos.length})</button>
            {usadas.map((c) => <button key={c} onClick={() => setFiltro(c)} style={{ ...(filtro === c ? {} : btnSec), ...chico, marginRight: 4 }}>{emojiDeCategoria(c)} {c} ({datos.articulos.filter((a) => a.categoria === c).length})</button>)}
          </p>
          {lista.map((a) => (
            <div key={a.id} style={{ ...caja, borderLeft: `4px solid ${COLOR[a.estado]}`, opacity: a.estado === "archivado" ? 0.7 : 1, padding: "0.8rem 1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 380px" }}>
                  <strong style={{ color: "#163A5C" }}>{a.destacado && "⭐ "}{a.titulo}</strong>{" "}
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: COLOR[a.estado] }}>{ESTADOS_ARTICULO[a.estado].toUpperCase()}</span>
                  <div style={{ fontSize: "0.84rem", color: "#6b727b" }}>
                    {emojiDeCategoria(a.categoria)} {a.categoria} · {sectoresDe(a)} · {[a.contenido && "texto", a.archivoNombre && (a.archivoMime === "application/pdf" ? "PDF" : "imagen"), a.enlace && "enlace"].filter(Boolean).join(" + ")} · actualizado el {dia(a.actualizadoEn)}
                  </div>
                </div>
                {a.estado === "publicado" && <div style={{ textAlign: "center", fontSize: "0.78rem", color: "#4A4F58" }}><div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#163A5C" }}>{a.lecturas} <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>de {a.destinatarios}</span></div>lo abrieron</div>}
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                {a.estado !== "publicado" && <button onClick={() => publicar(a)} style={chico}>Publicar</button>}
                <button onClick={() => editar(a)} style={{ ...btnSec, ...chico }}>Editar</button>
                {a.archivoNombre && <a href={`/api/biblioteca/${a.id}/archivo`} target="_blank" rel="noopener" style={{ ...chico, alignSelf: "center" }}>Ver archivo</a>}
                {a.estado === "publicado" && <button onClick={() => verLectores(a)} style={{ ...btnSec, ...chico }}>{lectores?.id === a.id ? "Cerrar" : "Quién lo abrió"}</button>}
                {a.estado === "publicado" && <button onClick={() => accion(a, { accion: "archivar" }, "Archivado: ya no se ve en el portal.", `"${a.titulo}" deja de verse en el portal. ¿Seguimos?`)} style={{ ...btnSec, ...chico }}>Archivar</button>}
                {a.estado !== "publicado" && <button onClick={() => accion(a, "borrar", "Artículo borrado.", `Se borra "${a.titulo}" con su archivo y el registro de quién lo abrió. ¿Seguimos?`)} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Borrar</button>}
              </div>
              {lectores?.id === a.id && (
                <table style={{ marginTop: "0.6rem" }}>
                  <thead><tr><th>Persona</th><th>Sector</th><th>Lo abrió</th></tr></thead>
                  <tbody>{lectores.personas.map((p) => <tr key={p.id}><td>{p.nombre}</td><td>{p.sector}</td><td>{p.leidoEn ? <span style={{ color: "#2F6F5E" }}>{dia(p.leidoEn)}</span> : <span style={{ color: "#8a5413" }}>Todavía no</span>}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          ))}
          <p style={{ maxWidth: 900, fontSize: "0.85rem", color: "#6b727b" }}>"Lo abrieron" cuenta quién entró al artículo, no que lo haya leído entero. Si necesitás constancia de lectura (un reglamento nuevo, un cambio de procedimiento), publicalo en <a href="/noticias">Noticias</a> con confirmación de lectura, y dejá acá la versión de consulta.</p>
        </>
      )}
    </main>
  );
}
