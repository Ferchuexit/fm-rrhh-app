"use client";
// FM RRHH — app/eventos/page.tsx
// Eventos de la empresa: se cargan, se publican (ahí se avisa a la gente) y
// se ve con cuántos contar. Después del evento se puede tomar asistencia.
import { useEffect, useState } from "react";
import { ESTADOS_EVENTO } from "@/lib/eventos-reglas";

type Resumen = { van: number; noVan: number; acompanantes: number; total: number; sinResponder: number; quedan: number | null; asistieron: number | null };
type Evento = { id: string; titulo: string; descripcion: string | null; lugar: string | null; fecha: string; hora: string | null; centroCostoIds: string[]; pideConfirmacion: boolean; limiteConfirmar: string | null; cupo: number | null; maxAcompanantes: number; estado: string; invitados: number; resumen: Resumen };
type Persona = { id: string; nombre: string; sector: string; va: boolean | null; acompanantes: number; asistio: boolean | null };
type Datos = { hoy: string; sectores: { id: string; nombre: string }[]; eventos: Evento[] };
type Form = { id: string; titulo: string; descripcion: string; lugar: string; fecha: string; hora: string; centroCostoIds: string[]; pideConfirmacion: boolean; limiteConfirmar: string; cupo: string; maxAcompanantes: string };

const VACIO: Form = { id: "", titulo: "", descripcion: "", lugar: "", fecha: "", hora: "", centroCostoIds: [], pideConfirmacion: true, limiteConfirmar: "", cupo: "", maxAcompanantes: "0" };
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "960px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.55rem", fontSize: "0.82rem" };
const COLOR: Record<string, string> = { borrador: "#8a5413", publicado: "#2F6F5E", cancelado: "#B23A3A" };
const diaLargo = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const iso = (f: string | null) => (f ? f.slice(0, 10) : "");

async function pedir(url: string, cuerpo?: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function EventosPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [errorForm, setErrorForm] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<{ resumen: Resumen; personas: Persona[] } | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "van" | "no" | "falta">("todos");

  async function cargar() {
    const r = await pedir("/api/eventos", undefined, "GET");
    if (!r.ok) { setError(r.d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(r.d);
  }
  async function cargarDetalle(id: string) {
    const r = await pedir(`/api/eventos/${id}`, undefined, "GET");
    if (r.ok) setDetalle(r.d); else setError(r.d.error ?? "No se pudo cargar.");
  }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!form) return;
    setErrorForm("");
    const r = await pedir("/api/eventos", form);
    if (!r.ok) { setErrorForm(r.d.error ?? "No se pudo guardar."); return; }
    setForm(null);
    setMsg(form.id ? "Cambios guardados." : "Evento guardado como borrador. Cuando esté listo, publicalo: ahí se le avisa a la gente.");
    cargar();
  }
  async function accion(e: Evento, cuerpo: Record<string, unknown>, ok: string | ((d: any) => string), confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setMsg(""); setError("");
    const r = cuerpo.accion === "borrar" ? await pedir(`/api/eventos/${e.id}`, undefined, "DELETE") : await pedir(`/api/eventos/${e.id}`, cuerpo);
    if (!r.ok) setError(r.d.error ?? "No se pudo completar."); else setMsg(typeof ok === "string" ? ok : ok(r.d));
    await cargar();
    if (abierto === e.id && cuerpo.accion !== "borrar") cargarDetalle(e.id);
  }
  function abrir(e: Evento) {
    setDetalle(null); setFiltro("todos");
    if (abierto === e.id) { setAbierto(null); return; }
    setAbierto(e.id);
    cargarDetalle(e.id);
  }
  const editar = (e: Evento) => { setErrorForm(""); setForm({ id: e.id, titulo: e.titulo, descripcion: e.descripcion ?? "", lugar: e.lugar ?? "", fecha: iso(e.fecha), hora: e.hora ?? "", centroCostoIds: e.centroCostoIds, pideConfirmacion: e.pideConfirmacion, limiteConfirmar: iso(e.limiteConfirmar), cupo: e.cupo === null ? "" : String(e.cupo), maxAcompanantes: String(e.maxAcompanantes) }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const hoy = datos ? iso(datos.hoy) : "";
  const proximos = (datos?.eventos ?? []).filter((e) => iso(e.fecha) >= hoy && e.estado !== "cancelado").reverse();
  const pasados = (datos?.eventos ?? []).filter((e) => iso(e.fecha) < hoy || e.estado === "cancelado");
  const sectoresDe = (e: Evento) => (e.centroCostoIds.length === 0 ? "Toda la empresa" : e.centroCostoIds.map((id) => datos?.sectores.find((s) => s.id === id)?.nombre ?? "?").join(", "));

  const tarjeta = (e: Evento) => {
    const paso = iso(e.fecha) < hoy;
    const esHoyOAntes = iso(e.fecha) <= hoy;
    const r = e.resumen;
    const personas = (detalle?.personas ?? []).filter((p) => (filtro === "todos" ? true : filtro === "van" ? p.va === true : filtro === "no" ? p.va === false : p.va === null));
    return (
      <div key={e.id} style={{ ...caja, borderLeft: `4px solid ${COLOR[e.estado]}`, opacity: e.estado === "cancelado" ? 0.7 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <strong style={{ fontSize: "1.05rem", color: "#163A5C" }}>{e.titulo}</strong>{" "}
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: COLOR[e.estado] }}>{ESTADOS_EVENTO[e.estado].toUpperCase()}</span>
            <div style={{ fontSize: "0.9rem", marginTop: 2 }}>{diaLargo(e.fecha)}{e.hora && `, ${e.hora} hs`}{e.lugar && ` · ${e.lugar}`}</div>
            <div style={{ fontSize: "0.82rem", color: "#6b727b" }}>{sectoresDe(e)} · {e.invitados} {e.invitados === 1 ? "invitado" : "invitados"}{e.cupo !== null && ` · cupo ${e.cupo}`}{e.maxAcompanantes > 0 && ` · hasta ${e.maxAcompanantes} acompañante${e.maxAcompanantes === 1 ? "" : "s"}`}{e.limiteConfirmar && ` · confirmar hasta el ${new Date(e.limiteConfirmar).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "UTC" })}`}</div>
          </div>
          {e.estado !== "borrador" && e.pideConfirmacion && (
            <div style={{ display: "flex", gap: "1.1rem", textAlign: "center", fontSize: "0.78rem", color: "#4A4F58" }}>
              <div><div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#2F6F5E" }}>{r.total}</div>van{r.acompanantes > 0 && <><br />({r.van} + {r.acompanantes} acomp.)</>}</div>
              <div><div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#B23A3A" }}>{r.noVan}</div>no van</div>
              <div><div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#8a5413" }}>{r.sinResponder}</div>sin responder</div>
              {r.asistieron !== null && <div><div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#163A5C" }}>{r.asistieron}</div>fueron</div>}
            </div>
          )}
        </div>
        {e.descripcion && <p style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", margin: "0.5rem 0 0" }}>{e.descripcion}</p>}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.7rem" }}>
          {e.estado === "borrador" && <button onClick={() => accion(e, { accion: "publicar" }, (d) => `Publicado. Se le avisó a ${d.avisados} ${d.avisados === 1 ? "persona" : "personas"} con acceso al portal.`, `Se publica "${e.titulo}" y se les avisa a ${e.invitados} personas. ¿Seguimos?`)}>Publicar y avisar</button>}
          {e.estado !== "borrador" && <button onClick={() => abrir(e)} style={btnSec}>{abierto === e.id ? "Cerrar" : e.pideConfirmacion ? "Ver quién va" : "Ver invitados"}</button>}
          {e.estado !== "cancelado" && !paso && <button onClick={() => editar(e)} style={btnSec}>Editar</button>}
          {e.estado === "publicado" && !paso && <button onClick={() => accion(e, { accion: "cancelar" }, "Evento cancelado. Se les avisó a los invitados.", `Se cancela "${e.titulo}" y se les avisa a los invitados. ¿Seguimos?`)} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A" }}>Cancelar el evento</button>}
          {e.estado === "borrador" && <button onClick={() => accion(e, { accion: "borrar" }, "Borrador eliminado.", "¿Borrar este borrador?")} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A" }}>Borrar</button>}
        </div>
        {abierto === e.id && (
          <div style={{ marginTop: "0.8rem", borderTop: "1px solid #dfe4e8", paddingTop: "0.7rem" }}>
            {!detalle ? <p>Cargando…</p> : (
              <>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.88rem" }}>
                  Mostrar:{" "}
                  {([["todos", "Todos"], ["van", "Van"], ["no", "No van"], ["falta", "Sin responder"]] as const).map(([k, n]) => <button key={k} onClick={() => setFiltro(k)} style={{ ...(filtro === k ? {} : btnSec), ...chico, marginRight: 4 }}>{n}</button>)}
                  {esHoyOAntes && e.estado === "publicado" && <span style={{ color: "#6b727b", marginLeft: 8 }}>Marcá quién fue: sirve para saber cuánta gente participa de verdad.</span>}
                </p>
                <table>
                  <thead><tr><th>Persona</th><th>Sector</th><th>Respuesta</th>{e.estado === "publicado" && <th>Anotar</th>}{esHoyOAntes && e.estado === "publicado" && <th>¿Fue?</th>}</tr></thead>
                  <tbody>
                    {personas.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td>{p.sector}</td>
                        <td>{p.va === null ? <span style={{ color: "#8a5413" }}>Sin responder</span> : p.va ? <strong style={{ color: "#2F6F5E" }}>Va{p.acompanantes > 0 && ` + ${p.acompanantes}`}</strong> : <span style={{ color: "#B23A3A" }}>No va</span>}</td>
                        {e.estado === "publicado" && <td style={{ whiteSpace: "nowrap" }}>
                          <button onClick={() => accion(e, { accion: "responder", legajoId: p.id, va: true }, "Anotado.")} style={{ ...btnSec, ...chico }} disabled={p.va === true}>Va</button>{" "}
                          <button onClick={() => accion(e, { accion: "responder", legajoId: p.id, va: false }, "Anotado.")} style={{ ...btnSec, ...chico }} disabled={p.va === false}>No va</button>
                        </td>}
                        {esHoyOAntes && e.estado === "publicado" && <td><input type="checkbox" aria-label={`${p.nombre} fue`} checked={p.asistio === true} onChange={(ev) => accion(e, { accion: "asistencia", legajoId: p.id, asistio: ev.target.checked }, "Asistencia guardada.")} /></td>}
                      </tr>
                    ))}
                    {personas.length === 0 && <tr><td colSpan={5} style={{ color: "#6b727b" }}>Nadie en esta lista.</td></tr>}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <main>
      <h1>Eventos</h1>
      <p style={{ maxWidth: "860px" }}>
        Lo que la empresa organiza para su gente: el asado de fin de año, una charla, una jornada, una campaña. Al publicarlo, cada invitado recibe el aviso y confirma desde el portal;
        el día anterior se les recuerda solo. Acá ves con cuántos contar.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {msg && <p style={{ color: "#2F6F5E" }}>{msg}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && !form && <p><button onClick={() => { setErrorForm(""); setForm({ ...VACIO }); }}>Nuevo evento</button></p>}

      {datos && form && (
        <div style={{ ...caja, borderLeft: "4px solid #163A5C" }}>
          <strong style={{ color: "#163A5C" }}>{form.id ? "Editar evento" : "Nuevo evento"}</strong>
          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <label style={{ flex: "2 1 300px" }}>Nombre<br /><input value={form.titulo} maxLength={100} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Asado de fin de año" style={{ width: "100%" }} /></label>
            <label>Día<br /><input type="date" value={form.fecha} min={hoy} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
            <label>Hora <span style={{ color: "#6b727b" }}>(opcional)</span><br /><input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></label>
          </div>
          <label style={{ display: "block", marginTop: "0.6rem" }}>Lugar <span style={{ color: "#6b727b" }}>(opcional)</span><br /><input value={form.lugar} maxLength={150} onChange={(e) => setForm({ ...form, lugar: e.target.value })} placeholder="Quincho del club, Av. San Martín 1200" style={{ width: "100%", maxWidth: 600 }} /></label>
          <label style={{ display: "block", marginTop: "0.6rem" }}>Detalle <span style={{ color: "#6b727b" }}>(opcional: qué llevar, cómo llegar, si hay transporte)</span><br /><textarea rows={3} maxLength={1500} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} style={{ width: "100%", maxWidth: 800 }} /></label>
          <div style={{ marginTop: "0.6rem" }}>
            <strong>Para quiénes:</strong>{" "}
            <label style={{ marginRight: 12 }}><input type="checkbox" checked={form.centroCostoIds.length === 0} onChange={() => setForm({ ...form, centroCostoIds: [] })} style={{ marginRight: 4 }} />Toda la empresa</label>
            {datos.sectores.map((s) => <label key={s.id} style={{ marginRight: 12 }}><input type="checkbox" checked={form.centroCostoIds.includes(s.id)} onChange={(e) => setForm({ ...form, centroCostoIds: e.target.checked ? [...form.centroCostoIds, s.id] : form.centroCostoIds.filter((x) => x !== s.id) })} style={{ marginRight: 4 }} />{s.nombre}</label>)}
          </div>
          <div style={{ marginTop: "0.6rem" }}>
            <label><input type="checkbox" checked={form.pideConfirmacion} onChange={(e) => setForm({ ...form, pideConfirmacion: e.target.checked })} style={{ marginRight: 4 }} /><strong>Pedir que confirmen si van</strong> <span style={{ color: "#6b727b" }}>(sacalo si es solo un anuncio: una campaña, un feriado de la empresa)</span></label>
          </div>
          {form.pideConfirmacion && (
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
              <label>Confirmar hasta <span style={{ color: "#6b727b" }}>(opcional)</span><br /><input type="date" value={form.limiteConfirmar} min={hoy} max={form.fecha || undefined} onChange={(e) => setForm({ ...form, limiteConfirmar: e.target.value })} /></label>
              <label>Cupo <span style={{ color: "#6b727b" }}>(vacío = sin tope)</span><br /><input type="number" min={1} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} style={{ width: 100 }} /></label>
              <label>Acompañantes por persona<br /><input type="number" min={0} max={10} value={form.maxAcompanantes} onChange={(e) => setForm({ ...form, maxAcompanantes: e.target.value })} style={{ width: 100 }} /></label>
            </div>
          )}
          {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button onClick={guardar}>{form.id ? "Guardar cambios" : "Guardar borrador"}</button>
            <button onClick={() => setForm(null)} style={btnSec}>Cancelar</button>
          </div>
          {form.id && <p style={{ fontSize: "0.8rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Si el evento ya está publicado y cambiás el día, la hora o el lugar, se les avisa a los invitados.</p>}
        </div>
      )}

      {datos && (
        <>
          <h2>Próximos ({proximos.length})</h2>
          {proximos.length === 0 && <p style={{ color: "#6b727b" }}>No hay eventos por venir.</p>}
          {proximos.map(tarjeta)}
          {pasados.length > 0 && <><h2>Anteriores y cancelados</h2>{pasados.map(tarjeta)}</>}
        </>
      )}
    </main>
  );
}
