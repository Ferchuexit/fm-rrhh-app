"use client";
// FM RRHH — app/agenda/page.tsx
// El calendario de la empresa. No se carga nada acá: junta lo que ya está
// en Eventos, Capacitaciones, Vacaciones, Solicitudes, Feriados, Encuestas
// y Evaluaciones, más los cumpleaños y aniversarios.
import { useEffect, useMemo, useState } from "react";
import { CATEGORIAS_EVENTO } from "@/lib/eventos-reglas";
import { TIPOS_AGENDA, CLAVES_TIPO, rangoDelMes, grillaDelMes, porDia, ausentesPorDia, mesVecino, isoDia, type ItemAgenda, type TipoAgenda } from "@/lib/agenda-reglas";

type Datos = { mes: string; hoy: string; items: ItemAgenda[] };
type Nueva = { categoria: string; titulo: string; fecha: string; hora: string; lugar: string; descripcion: string; centroCostoIds: string[]; avisar: boolean };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const diaLargo = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const corto = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "UTC" });

export default function AgendaPage() {
  const [mes, setMes] = useState("");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [ocultos, setOcultos] = useState<TipoAgenda[]>([]);
  const [dia, setDia] = useState<string | null>(null);
  const [nueva, setNueva] = useState<Nueva | null>(null);
  const [sectores, setSectores] = useState<{ id: string; nombre: string }[]>([]);
  const [errorNueva, setErrorNueva] = useState("");
  const [msg, setMsg] = useState("");
  const [vuelta, setVuelta] = useState(0); // para volver a pedir la agenda después de agregar


  async function guardarNueva() {
    if (!nueva) return;
    setErrorNueva("");
    const res = await fetch("/api/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nueva) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErrorNueva(d.error ?? "No se pudo guardar."); return; }
    setMsg(`Agregado a la agenda${nueva.avisar ? `: se le avisó a ${d.avisados} ${d.avisados === 1 ? "persona" : "personas"} con acceso al portal` : ""}. El día anterior se les recuerda solo.`);
    setDia(nueva.fecha); setMes(nueva.fecha.slice(0, 7)); setNueva(null); setVuelta((v) => v + 1);
  }

  useEffect(() => {
    fetch(`/api/agenda${mes ? `?mes=${mes}` : ""}`).then(async (res) => {
      const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
      if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
      setError("");
      // Las fechas llegan como texto.
      setDatos({ ...d, items: d.items.map((i: any) => ({ ...i, fecha: new Date(i.fecha), hasta: i.hasta ? new Date(i.hasta) : null })) });
      setSectores(d.sectores ?? []);
      setDia((x) => x ?? d.hoy.slice(0, 10)); // solo la primera vez: no pisa el día que ya eligió
    });
  }, [mes, vuelta]);

  const vista = useMemo(() => {
    if (!datos) return null;
    const { desde, hasta } = rangoDelMes(datos.mes, new Date(datos.hoy));
    const semanas = grillaDelMes(desde, hasta);
    const visibles = datos.items.filter((i) => !ocultos.includes(i.tipo));
    const ini = semanas[0][0], fin = semanas[semanas.length - 1][6];
    return { desde, semanas, dias: porDia(visibles, ini, fin), ausentes: ausentesPorDia(datos.items, ini, fin), cuenta: Object.fromEntries(CLAVES_TIPO.map((t) => [t, datos.items.filter((i) => i.tipo === t).length])) };
  }, [datos, ocultos]);

  const hoy = datos?.hoy.slice(0, 10) ?? "";
  const delDia = dia && vista ? vista.dias.get(dia) ?? [] : [];
  const titulo = vista ? vista.desde.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }) : "";

  return (
    <main>
      <h1>Agenda</h1>
      <p style={{ maxWidth: "880px" }}>
        Todo lo que tiene fecha, en un solo calendario: eventos, capacitaciones, feriados, vacaciones y permisos aprobados, cumpleaños, aniversarios y fechas límite.
        Casi todo sale solo de cada módulo; lo que no está en ninguno (una entrega, una auditoría, una reunión) lo agregás acá. Tocá un día para ver el detalle.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {msg && <p style={{ color: "#2F6F5E" }}>{msg}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && !nueva && <p><button onClick={() => { setMsg(""); setErrorNueva(""); setNueva({ categoria: "entrega", titulo: "", fecha: dia && dia >= hoy ? dia : hoy, hora: "", lugar: "", descripcion: "", centroCostoIds: [], avisar: true }); }}>Agregar a la agenda</button></p>}
      {datos && nueva && (
        <div style={{ background: "white", border: "1px solid #dfe4e8", borderLeft: "4px solid #C2410C", padding: "1rem", marginBottom: "1rem", maxWidth: 900 }}>
          <strong style={{ color: "#163A5C" }}>Agregar una fecha a la agenda</strong>
          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <label>Qué es<br /><select value={nueva.categoria} onChange={(e) => setNueva({ ...nueva, categoria: e.target.value })}>{Object.entries(CATEGORIAS_EVENTO).filter(([k]) => k !== "social").map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.nombre}</option>)}</select></label>
            <label style={{ flex: "2 1 300px" }}>Título<br /><input value={nueva.titulo} maxLength={100} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} placeholder="Producto listo para revisión de calidad — pedido Tigre" style={{ width: "100%" }} /></label>
            <label>Día<br /><input type="date" value={nueva.fecha} min={hoy} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} /></label>
            <label>Hora <span style={{ color: "#6b727b" }}>(opcional)</span><br /><input type="time" value={nueva.hora} onChange={(e) => setNueva({ ...nueva, hora: e.target.value })} /></label>
          </div>
          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <label style={{ flex: "1 1 240px" }}>Lugar <span style={{ color: "#6b727b" }}>(opcional)</span><br /><input value={nueva.lugar} maxLength={150} onChange={(e) => setNueva({ ...nueva, lugar: e.target.value })} style={{ width: "100%" }} /></label>
            <label style={{ flex: "2 1 340px" }}>Detalle <span style={{ color: "#6b727b" }}>(opcional: qué tiene que estar listo, quién viene)</span><br /><input value={nueva.descripcion} maxLength={1500} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} style={{ width: "100%" }} /></label>
          </div>
          <div style={{ marginTop: "0.6rem" }}>
            <strong>Quiénes lo ven:</strong>{" "}
            <label style={{ marginRight: 12 }}><input type="checkbox" checked={nueva.centroCostoIds.length === 0} onChange={() => setNueva({ ...nueva, centroCostoIds: [] })} style={{ marginRight: 4 }} />Toda la empresa</label>
            {sectores.map((s) => <label key={s.id} style={{ marginRight: 12 }}><input type="checkbox" checked={nueva.centroCostoIds.includes(s.id)} onChange={(e) => setNueva({ ...nueva, centroCostoIds: e.target.checked ? [...nueva.centroCostoIds, s.id] : nueva.centroCostoIds.filter((x) => x !== s.id) })} style={{ marginRight: 4 }} />{s.nombre}</label>)}
          </div>
          <label style={{ display: "block", marginTop: "0.5rem" }}><input type="checkbox" checked={nueva.avisar} onChange={(e) => setNueva({ ...nueva, avisar: e.target.checked })} style={{ marginRight: 4 }} />Avisarles ahora <span style={{ color: "#6b727b" }}>(notificación y mail; el día anterior se les recuerda igual)</span></label>
          {errorNueva && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorNueva}</p>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}><button onClick={guardarNueva}>Agregar</button><button onClick={() => setNueva(null)} style={btnSec}>Cancelar</button></div>
          <p style={{ fontSize: "0.8rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Para cambiarla o cancelarla después: Cultura → Eventos. Si necesitás que la gente confirme asistencia (un asado, una jornada), cargalo directamente ahí.</p>
        </div>
      )}
      {datos && vista && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            <button onClick={() => setMes(mesVecino(datos.mes, -1))} style={btnSec} aria-label="Mes anterior">‹</button>
            <strong style={{ fontSize: "1.2rem", color: "#163A5C", minWidth: 190, textAlign: "center" }}>{titulo.replace(/^./, (c) => c.toUpperCase())}</strong>
            <button onClick={() => setMes(mesVecino(datos.mes, 1))} style={btnSec} aria-label="Mes siguiente">›</button>
            <button onClick={() => { setMes(hoy.slice(0, 7)); setDia(hoy); }} style={btnSec}>Hoy</button>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
            {CLAVES_TIPO.map((t) => {
              const off = ocultos.includes(t);
              return <button key={t} onClick={() => setOcultos(off ? ocultos.filter((x) => x !== t) : [...ocultos, t])} aria-pressed={!off} style={{ padding: "0.2rem 0.6rem", fontSize: "0.82rem", borderRadius: 999, border: `1px solid ${TIPOS_AGENDA[t].color}`, background: off ? "white" : TIPOS_AGENDA[t].color, color: off ? TIPOS_AGENDA[t].color : "white", opacity: off ? 0.6 : 1 }}>{TIPOS_AGENDA[t].emoji} {TIPOS_AGENDA[t].nombre} ({vista.cuenta[t]})</button>;
            })}
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "3 1 620px", maxWidth: 900, background: "white", border: "1px solid #dfe4e8" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#163A5C", color: "white", fontSize: "0.8rem", fontWeight: 700, textAlign: "center" }}>{DIAS.map((d) => <div key={d} style={{ padding: "0.35rem 0" }}>{d}</div>)}</div>
              {vista.semanas.map((sem) => (
                <div key={isoDia(sem[0])} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                  {sem.map((d) => {
                    const k = isoDia(d), lista = vista.dias.get(k) ?? [], fuera = k.slice(0, 7) !== datos.mes, afuera = vista.ausentes.get(k) ?? 0;
                    const feriado = lista.some((i) => i.tipo === "feriado"), finde = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                    return (
                      <button key={k} onClick={() => setDia(k)} aria-label={`${diaLargo(k)}: ${lista.length} ${lista.length === 1 ? "cosa" : "cosas"}`} style={{ minHeight: 92, textAlign: "left", verticalAlign: "top", display: "block", padding: "0.25rem", borderRadius: 0, border: 0, borderTop: "1px solid #dfe4e8", borderLeft: "1px solid #eef2f5", outline: dia === k ? "2px solid #163A5C" : undefined, outlineOffset: -2, background: feriado ? "#fbefef" : finde ? "#f6f8fa" : "white", color: "#12202e", opacity: fuera ? 0.45 : 1, cursor: "pointer", overflow: "hidden" }}>
                        <span style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                          <span style={k === hoy ? { background: "#163A5C", color: "white", borderRadius: 999, padding: "0 6px", fontWeight: 700 } : { fontWeight: 600 }}>{d.getUTCDate()}</span>
                          {afuera > 0 && <span title="Personas de vacaciones o con permiso" style={{ color: "#2F6F5E", fontSize: "0.7rem" }}>{afuera} afuera</span>}
                        </span>
                        {lista.filter((i) => i.tipo !== "vacaciones" && i.tipo !== "permiso").slice(0, 3).map((i) => <span key={i.clave} style={{ display: "block", fontSize: "0.7rem", marginTop: 2, padding: "1px 4px", borderRadius: 3, background: TIPOS_AGENDA[i.tipo].color, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.hora ? `${i.hora} ` : ""}{i.titulo}</span>)}
                        {lista.filter((i) => i.tipo !== "vacaciones" && i.tipo !== "permiso").length > 3 && <span style={{ display: "block", fontSize: "0.68rem", color: "#6b727b" }}>+{lista.filter((i) => i.tipo !== "vacaciones" && i.tipo !== "permiso").length - 3} más</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ flex: "1 1 280px", maxWidth: 420, background: "white", border: "1px solid #dfe4e8", padding: "0.9rem" }}>
              <strong style={{ color: "#163A5C" }}>{dia ? diaLargo(dia).replace(/^./, (c) => c.toUpperCase()) : "Elegí un día"}</strong>
              {dia && delDia.length === 0 && <p style={{ color: "#6b727b", margin: "0.4rem 0 0" }}>Nada agendado.</p>}
              {delDia.map((i) => (
                <div key={i.clave} style={{ borderLeft: `4px solid ${TIPOS_AGENDA[i.tipo].color}`, padding: "0.3rem 0.6rem", marginTop: "0.5rem", fontSize: "0.9rem" }}>
                  <div style={{ fontSize: "0.72rem", color: TIPOS_AGENDA[i.tipo].color, fontWeight: 700 }}>{TIPOS_AGENDA[i.tipo].emoji} {TIPOS_AGENDA[i.tipo].nombre.toUpperCase()}{i.hora && ` · ${i.hora} hs`}</div>
                  {i.url ? <a href={i.url} style={{ fontWeight: 600 }}>{i.titulo}</a> : <span style={{ fontWeight: 600 }}>{i.titulo}</span>}
                  {(i.detalle || i.hasta) && <div style={{ color: "#6b727b", fontSize: "0.82rem" }}>{[i.hasta ? `del ${corto(i.fecha)} al ${corto(i.hasta)}` : null, i.detalle].filter(Boolean).join(" · ")}</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
