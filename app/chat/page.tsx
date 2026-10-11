"use client";
// FM RRHH — app/chat/page.tsx
// El chat del lado de RR.HH.: las consultas de los empleados (una bandeja
// compartida: responde cualquiera de RR.HH.) y los grupos de la empresa.
// Las charlas directas entre compañeros no se ven desde acá.
import { useEffect, useRef, useState } from "react";

type Grupo = { id: string; nombre: string; descripcion: string | null; emoji: string; todos: boolean; centroCostoIds: string[]; soloAnuncios: boolean; archivada: boolean; ultimo: string | null; ultimoEn: string | null; agregados: number; miembros: number };
type Consulta = { id: string; empleadoId: string; nombre: string; sector: string | null; ultimo: string | null; ultimoEn: string | null; sinLeer: number };
type Datos = { chatEntreEmpleados: boolean; limitado: boolean; sectores: { id: string; nombre: string }[]; legajos: { id: string; nombre: string; sector: string }[]; grupos: Grupo[]; consultas: Consulta[] };
type Msj = { id: string; autorId: string | null; autor: string; deRRHH: boolean; texto: string; borrado: boolean; cuando: string };
type Miembro = { legajoId: string; admin: boolean };
type Form = { id: string; nombre: string; descripcion: string; emoji: string; todos: boolean; centroCostoIds: string[]; soloAnuncios: boolean };

const VACIO: Form = { id: "", nombre: "", descripcion: "", emoji: "💬", todos: false, centroCostoIds: [], soloAnuncios: false };
const TZ = "America/Argentina/Buenos_Aires";
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.55rem", fontSize: "0.82rem" };
const rotulo: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", color: "#6b727b", padding: "0.6rem 0.8rem 0.3rem", textTransform: "uppercase" };
const diaClave = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const cuando = (iso: string | null) => (!iso ? "" : diaClave(iso) === diaClave(new Date().toISOString()) ? hora(iso) : new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: TZ }));

async function pedir(url: string, cuerpo?: unknown) {
  const res = await fetch(url, cuerpo === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function ChatPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Msj[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [texto, setTexto] = useState("");
  const [errorHilo, setErrorHilo] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [errorForm, setErrorForm] = useState("");
  const [verMiembros, setVerMiembros] = useState(false);
  const [agregar, setAgregar] = useState("");
  const [escribirA, setEscribirA] = useState("");
  const [nuevoCon, setNuevoCon] = useState(""); // nombre de la persona a la que RR.HH. le escribe primero
  const ultimo = useRef<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);

  async function cargar() {
    const r = await pedir("/api/chat");
    if (!r.ok) { setError(r.d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(r.d);
  }
  useEffect(() => { cargar(); const t = setInterval(() => { if (!document.hidden) cargar(); }, 20000); return () => clearInterval(t); }, []);

  async function abrir(id: string) {
    setAbierta(id); setMensajes([]); setMiembros([]); setTexto(""); setErrorHilo(""); setVerMiembros(false); setForm(null); setNuevoCon(""); ultimo.current = null;
    const r = await pedir(`/api/chat/${id}`);
    if (!r.ok) { setErrorHilo(r.d.error ?? "No se pudo cargar."); return; }
    setMensajes(r.d.mensajes); setMiembros(r.d.miembros ?? []);
    ultimo.current = r.d.mensajes.length ? r.d.mensajes[r.d.mensajes.length - 1].cuando : null;
    cargar(); // baja el contador de sin leer
  }
  const sumar = (nuevos: Msj[]) => {
    if (!nuevos.length) return;
    setMensajes((m) => { const ids = new Set(m.map((x) => x.id)); return [...m, ...nuevos.filter((x) => !ids.has(x.id))]; });
    ultimo.current = nuevos[nuevos.length - 1].cuando;
  };
  // Mientras hay una conversación abierta, se piden los mensajes nuevos.
  useEffect(() => {
    if (!abierta) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await pedir(`/api/chat/${abierta}${ultimo.current ? `?desde=${encodeURIComponent(ultimo.current)}` : ""}`).catch(() => null);
      if (r?.ok) sumar(r.d.mensajes);
    }, 4000);
    return () => clearInterval(t);
  }, [abierta]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest" }); }, [mensajes.length]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!abierta || !texto.trim()) return;
    setErrorHilo("");
    const r = await pedir(`/api/chat/${abierta}`, { texto });
    if (!r.ok) { setErrorHilo(r.d.error ?? "No se pudo enviar."); return; }
    sumar([r.d.mensaje]); setTexto(""); cargar();
  }
  async function borrar(m: Msj) {
    if (!abierta || !window.confirm("Se saca este mensaje de la conversación. ¿Seguimos?")) return;
    const r = await pedir(`/api/chat/${abierta}`, { accion: "borrar", mensajeId: m.id });
    if (r.ok) setMensajes((l) => l.map((x) => (x.id === m.id ? { ...x, borrado: true, texto: "" } : x))); else setErrorHilo(r.d.error ?? "No se pudo borrar.");
  }
  async function guardarGrupo() {
    if (!form) return;
    setErrorForm("");
    const r = await pedir("/api/chat", { accion: "grupo", ...form });
    if (!r.ok) { setErrorForm(r.d.error ?? "No se pudo guardar."); return; }
    setForm(null);
    await cargar();
    abrir(r.d.id);
  }
  async function accion(cuerpo: Record<string, unknown>) {
    const r = await pedir("/api/chat", cuerpo);
    if (!r.ok) setError(r.d.error ?? "No se pudo guardar.");
    cargar();
  }
  async function miembro(legajoId: string, cambio: Record<string, unknown>) {
    if (!abierta) return;
    const r = await pedir(`/api/chat/${abierta}`, { accion: "miembros", legajoId, ...cambio });
    if (!r.ok) { setErrorHilo(r.d.error ?? "No se pudo guardar."); return; }
    const d = await pedir(`/api/chat/${abierta}`);
    if (d.ok) setMiembros(d.d.miembros ?? []);
    cargar();
  }
  async function escribirle() {
    if (!escribirA) return;
    const r = await pedir("/api/chat", { accion: "abrir", legajoId: escribirA });
    if (!r.ok) { setError(r.d.error ?? "No se pudo abrir."); return; }
    const nombre = datos?.legajos.find((l) => l.id === escribirA)?.nombre ?? "";
    setEscribirA("");
    await abrir(r.d.id);
    setNuevoCon(nombre);
  }

  const grupo = datos?.grupos.find((g) => g.id === abierta) ?? null;
  const consulta = datos?.consultas.find((c) => c.id === abierta) ?? null;
  const nombreDe = (id: string) => datos?.legajos.find((l) => l.id === id)?.nombre ?? "(ya no está)";
  const paraQuienes = (g: Grupo) => (g.todos ? "Toda la empresa" : [...g.centroCostoIds.map((id) => datos?.sectores.find((s) => s.id === id)?.nombre ?? "?"), ...(g.agregados ? [`${g.agregados} ${g.agregados === 1 ? "persona elegida" : "personas elegidas"}`] : [])].join(" + ") || "Sin miembros todavía");
  const item = (id: string, emoji: string, titulo: string, previa: string | null, fecha: string | null, sinLeer = 0, apagado = false) => (
    <button key={id} onClick={() => abrir(id)} style={{ display: "flex", gap: "0.6rem", alignItems: "center", width: "100%", textAlign: "left", padding: "0.55rem 0.8rem", border: 0, borderTop: "1px solid #eef2f5", borderRadius: 0, background: abierta === id ? "#e8f0f6" : "white", color: "#12202e", cursor: "pointer", opacity: apagado ? 0.55 : 1 }}>
      <span style={{ fontSize: "1.3rem" }} aria-hidden="true">{emoji}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: sinLeer ? 700 : 600, fontSize: "0.92rem" }}>{titulo}</span>
        <span style={{ display: "block", fontSize: "0.8rem", color: "#6b727b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: sinLeer ? 700 : 400 }}>{previa ?? "Sin mensajes"}</span>
      </span>
      <span style={{ fontSize: "0.72rem", color: "#6b727b", textAlign: "right" }}>{cuando(fecha)}{sinLeer > 0 && <><br /><span style={{ display: "inline-block", minWidth: 20, lineHeight: "20px", padding: "0 5px", textAlign: "center", background: "#B23A3A", color: "white", borderRadius: 999, fontWeight: 700 }}>{sinLeer}</span></>}</span>
    </button>
  );

  return (
    <main>
      <h1>Chat y grupos</h1>
      <p style={{ maxWidth: "900px" }}>
        Los empleados escriben desde el portal. Acá están sus <strong>consultas a RR.HH.</strong> (una bandeja compartida: responde cualquiera del área y el empleado ve quién le contestó) y los <strong>grupos</strong> de la empresa.
        Los mensajes entre compañeros son privados y no se ven desde acá.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && (
        <>
          {!datos.limitado && (
            <p style={{ fontSize: "0.9rem" }}>
              <label><input type="checkbox" checked={datos.chatEntreEmpleados} onChange={(e) => accion({ accion: "config", chatEntreEmpleados: e.target.checked })} style={{ marginRight: 5 }} />Permitir mensajes uno a uno entre compañeros</label>
              <span style={{ color: "#6b727b" }}> — si lo sacás, quedan solo los grupos y el chat con RR.HH.</span>
            </p>
          )}
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap", maxWidth: 1150 }}>
            <div style={{ ...caja, flex: "1 1 300px", maxWidth: 380 }}>
              <div style={rotulo}>Consultas a RR.HH. ({datos.consultas.length})</div>
              <div style={{ display: "flex", gap: 4, padding: "0 0.8rem 0.6rem" }}>
                <select value={escribirA} onChange={(e) => setEscribirA(e.target.value)} style={{ flex: 1, minWidth: 0 }} aria-label="Escribirle a un empleado"><option value="">Escribirle a…</option>{datos.legajos.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
                <button onClick={escribirle} disabled={!escribirA} style={chico}>Abrir</button>
              </div>
              {datos.consultas.length === 0 && <p style={{ padding: "0 0.8rem 0.6rem", margin: 0, fontSize: "0.85rem", color: "#6b727b" }}>Nadie escribió todavía.</p>}
              {datos.consultas.map((c) => item(c.id, "👤", c.nombre, c.ultimo, c.ultimoEn, c.sinLeer))}
              <div style={{ ...rotulo, borderTop: "1px solid #dfe4e8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Grupos ({datos.grupos.filter((g) => !g.archivada).length})</span>
                {!datos.limitado && <button onClick={() => { setAbierta(null); setErrorForm(""); setForm({ ...VACIO }); }} style={{ ...chico, textTransform: "none", letterSpacing: 0 }}>Nuevo grupo</button>}
              </div>
              {datos.grupos.length === 0 && <p style={{ padding: "0 0.8rem 0.6rem", margin: 0, fontSize: "0.85rem", color: "#6b727b" }}>Todavía no hay grupos. Un buen comienzo: uno de toda la empresa para anuncios, y uno por sector.</p>}
              {datos.grupos.map((g) => item(g.id, g.emoji, `${g.nombre}${g.archivada ? " (archivado)" : ""}`, g.ultimo ?? paraQuienes(g), g.ultimoEn, 0, g.archivada))}
            </div>

            <div style={{ ...caja, flex: "2 1 460px", minHeight: 420, display: "flex", flexDirection: "column" }}>
              {form ? (
                <div style={{ padding: "1rem" }}>
                  <strong style={{ color: "#163A5C" }}>{form.id ? "Editar grupo" : "Nuevo grupo"}</strong>
                  <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.6rem" }}>
                    <label>Ícono<br /><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} style={{ width: 60, textAlign: "center" }} /></label>
                    <label style={{ flex: 1 }}>Nombre<br /><input value={form.nombre} maxLength={60} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Taller" style={{ width: "100%" }} /></label>
                  </div>
                  <label style={{ display: "block", marginTop: "0.6rem" }}>Para qué es <span style={{ color: "#6b727b" }}>(opcional)</span><br /><input value={form.descripcion} maxLength={300} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} style={{ width: "100%" }} /></label>
                  <div style={{ marginTop: "0.7rem" }}>
                    <strong>Quiénes están:</strong><br />
                    <label style={{ marginRight: 12 }}><input type="checkbox" checked={form.todos} onChange={(e) => setForm({ ...form, todos: e.target.checked, centroCostoIds: [] })} style={{ marginRight: 4 }} />Toda la empresa</label>
                    {!form.todos && datos.sectores.map((s) => <label key={s.id} style={{ marginRight: 12 }}><input type="checkbox" checked={form.centroCostoIds.includes(s.id)} onChange={(e) => setForm({ ...form, centroCostoIds: e.target.checked ? [...form.centroCostoIds, s.id] : form.centroCostoIds.filter((x) => x !== s.id) })} style={{ marginRight: 4 }} />{s.nombre}</label>)}
                    <p style={{ fontSize: "0.82rem", color: "#6b727b", margin: "0.3rem 0 0" }}>Por sector, la gente entra y sale sola cuando cambia de sector, ingresa o se va. Además (o en vez de eso) podés agregar personas a mano después de crearlo: una brigada, un proyecto, los supervisores.</p>
                  </div>
                  <label style={{ display: "block", marginTop: "0.7rem" }}><input type="checkbox" checked={form.soloAnuncios} onChange={(e) => setForm({ ...form, soloAnuncios: e.target.checked })} style={{ marginRight: 4 }} /><strong>Grupo de anuncios</strong> <span style={{ color: "#6b727b" }}>— solo escriben RR.HH. y los encargados; el resto lee</span></label>
                  {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}><button onClick={guardarGrupo}>{form.id ? "Guardar cambios" : "Crear grupo"}</button><button onClick={() => setForm(null)} style={btnSec}>Cancelar</button></div>
                </div>
              ) : !abierta ? (
                <p style={{ margin: "auto", color: "#6b727b", padding: "2rem", textAlign: "center" }}>Elegí una conversación de la izquierda.</p>
              ) : (
                <>
                  <div style={{ padding: "0.7rem 1rem", borderBottom: "1px solid #dfe4e8" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                      <strong style={{ color: "#163A5C", fontSize: "1.05rem" }}>{grupo ? `${grupo.emoji} ${grupo.nombre}` : consulta ? consulta.nombre : nuevoCon || "Consulta"}</strong>
                      {grupo && !datos.limitado && (
                        <span style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => setVerMiembros(!verMiembros)} style={{ ...btnSec, ...chico }}>{verMiembros ? "Cerrar" : "Personas"}</button>
                          <button onClick={() => { setErrorForm(""); setForm({ id: grupo.id, nombre: grupo.nombre, descripcion: grupo.descripcion ?? "", emoji: grupo.emoji, todos: grupo.todos, centroCostoIds: grupo.centroCostoIds, soloAnuncios: grupo.soloAnuncios }); }} style={{ ...btnSec, ...chico }}>Editar</button>
                          <button onClick={() => accion({ accion: grupo.archivada ? "reactivar" : "archivar", id: grupo.id })} style={{ ...btnSec, ...chico }}>{grupo.archivada ? "Reactivar" : "Archivar"}</button>
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#6b727b" }}>{grupo ? <>{paraQuienes(grupo)} · {grupo.miembros} {grupo.miembros === 1 ? "persona" : "personas"}{grupo.soloAnuncios && " · grupo de anuncios"}{grupo.descripcion && ` · ${grupo.descripcion}`}</> : consulta?.sector ?? "Consulta con RR.HH."}</div>
                    {grupo && verMiembros && (
                      <div style={{ marginTop: "0.6rem", fontSize: "0.88rem" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <select value={agregar} onChange={(e) => setAgregar(e.target.value)} style={{ flex: 1, minWidth: 0 }} aria-label="Agregar una persona"><option value="">Agregar a mano a…</option>{datos.legajos.filter((l) => !miembros.some((m) => m.legajoId === l.id)).map((l) => <option key={l.id} value={l.id}>{l.nombre} · {l.sector}</option>)}</select>
                          <button onClick={() => { if (agregar) { miembro(agregar, {}); setAgregar(""); } }} disabled={!agregar} style={chico}>Agregar</button>
                        </div>
                        {miembros.length === 0 ? <p style={{ color: "#6b727b", margin: "0.4rem 0 0" }}>Nadie agregado a mano. {grupo.todos || grupo.centroCostoIds.length ? "Los que están, están por su sector." : "Agregá a las personas del grupo."}</p> : (
                          <table style={{ marginTop: "0.4rem" }}><tbody>
                            {miembros.map((m) => <tr key={m.legajoId}><td>{nombreDe(m.legajoId)}</td><td><label><input type="checkbox" checked={m.admin} onChange={(e) => miembro(m.legajoId, { admin: e.target.checked })} style={{ marginRight: 4 }} />Encargado{grupo.soloAnuncios && " (puede escribir)"}</label></td><td><button onClick={() => miembro(m.legajoId, { quitar: true })} style={{ ...btnSec, ...chico }}>Quitar</button></td></tr>)}
                          </tbody></table>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", maxHeight: 460, padding: "0.8rem 1rem", display: "flex", flexDirection: "column", gap: 5, background: "#f6f8fa" }}>
                    {mensajes.length === 0 && <p style={{ margin: "auto", color: "#6b727b" }}>Sin mensajes todavía.</p>}
                    {mensajes.map((m, i) => {
                      const otroDia = i === 0 || diaClave(mensajes[i - 1].cuando) !== diaClave(m.cuando);
                      return (
                        <div key={m.id} style={{ display: "contents" }}>
                          {otroDia && <span style={{ alignSelf: "center", fontSize: "0.72rem", color: "#6b727b", background: "#e3e8ec", padding: "0.1rem 0.6rem", borderRadius: 999, margin: "0.4rem 0 0.1rem" }}>{new Date(m.cuando).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}</span>}
                          <div style={{ maxWidth: "78%", alignSelf: m.deRRHH ? "flex-end" : "flex-start", background: m.deRRHH ? "#dcebf5" : "white", border: "1px solid #dfe4e8", borderRadius: 10, padding: "0.4rem 0.65rem", fontSize: "0.92rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: m.borrado ? "#6b727b" : undefined, fontStyle: m.borrado ? "italic" : undefined }}>
                            <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#163A5C" }}>{m.autor}</span>
                            {m.borrado ? "Mensaje eliminado" : m.texto}
                            <span style={{ display: "block", fontSize: "0.66rem", color: "#6b727b", textAlign: "right" }}>{hora(m.cuando)}{!m.borrado && <button onClick={() => borrar(m)} style={{ background: "none", border: 0, padding: 0, marginLeft: 8, color: "#8d2a2a", fontSize: "0.66rem", textDecoration: "underline", cursor: "pointer" }}>borrar</button>}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={fin} />
                  </div>
                  {errorHilo && <p style={{ color: "#B23A3A", margin: 0, padding: "0.4rem 1rem" }}>{errorHilo}</p>}
                  {grupo?.archivada ? <p style={{ margin: 0, padding: "0.7rem 1rem", color: "#6b727b", fontSize: "0.88rem" }}>Grupo archivado: los empleados ya no lo ven. Reactivalo para volver a usarlo.</p> : (
                    <form onSubmit={enviar} style={{ display: "flex", gap: "0.5rem", padding: "0.6rem 1rem", borderTop: "1px solid #dfe4e8" }}>
                      <textarea rows={2} value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder={grupo ? "Escribir al grupo como RR.HH. (Enter envía)" : "Responder como RR.HH. (Enter envía)"} aria-label="Mensaje" style={{ flex: 1, resize: "vertical" }} />
                      <button type="submit" disabled={!texto.trim()}>Enviar</button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
