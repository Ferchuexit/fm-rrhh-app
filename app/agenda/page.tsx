"use client";
// FM RRHH — app/agenda/page.tsx
// El calendario de la empresa. No se carga nada acá: junta lo que ya está
// en Eventos, Capacitaciones, Vacaciones, Solicitudes, Feriados, Encuestas
// y Evaluaciones, más los cumpleaños y aniversarios.
import { useEffect, useMemo, useState } from "react";
import { TIPOS_AGENDA, CLAVES_TIPO, rangoDelMes, grillaDelMes, porDia, ausentesPorDia, mesVecino, isoDia, type ItemAgenda, type TipoAgenda } from "@/lib/agenda-reglas";

type Datos = { mes: string; hoy: string; items: ItemAgenda[] };
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

  useEffect(() => {
    fetch(`/api/agenda${mes ? `?mes=${mes}` : ""}`).then(async (res) => {
      const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
      if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
      setError("");
      // Las fechas llegan como texto.
      setDatos({ ...d, items: d.items.map((i: any) => ({ ...i, fecha: new Date(i.fecha), hasta: i.hasta ? new Date(i.hasta) : null })) });
      if (!mes) setDia(d.hoy.slice(0, 10));
    });
  }, [mes]);

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
        Acá no se carga nada: sale solo de cada módulo. Tocá un día para ver el detalle.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}
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
