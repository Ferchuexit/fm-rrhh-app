"use client";
// FM RRHH — app/organigrama/Arbol.tsx
// El organigrama dibujado: una tarjeta por persona, unidas por líneas a su
// jefe. Lo usan el panel y el portal.
//
// Pensado para una planta: un jefe puede tener 30 operarios. Si se pusieran
// todos en fila, el árbol sería imposible de recorrer; por eso los que no
// tienen gente a cargo van agrupados en una grilla compacta debajo de su
// jefe, y solo las ramas con más niveles se abren hacia los costados.
import { useEffect, useMemo, useRef, useState } from "react";
import { armarArbol, cadenaDeMando, iniciales, type NodoOrg } from "@/lib/organigrama-reglas";

export interface PersonaArbol { id: string; nombre: string; apellido: string; sector: string | null; puesto: string | null; jefeId: string | null }
type P = PersonaArbol & { pila: string };

// Un color por sector (siempre el mismo para el mismo nombre). El sector
// además va escrito: el color solo ayuda a ubicarse.
const TONOS = [["#dbe9fb", "#1c5cab"], ["#fde3d6", "#a8431a"], ["#d5f2e6", "#0e6e4c"], ["#fdeec7", "#7d5400"], ["#fbdde8", "#a53565"], ["#e2def9", "#4a3bb0"], ["#dfeee0", "#1f6b1f"], ["#e6eaee", "#4a4f58"]];
const tono = (sector: string | null) => { if (!sector) return TONOS[7]; let h = 0; for (const c of sector) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TONOS[h % 7]; };
const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CSS = `
.org-lienzo { overflow: auto; background: #f6f8fa; border: 1px solid #dfe4e8; padding: 1.2rem; max-height: 78vh; }
.org-arbol { display: inline-flex; flex-direction: column; align-items: center; min-width: 100%; }
.org-nodo { display: flex; flex-direction: column; align-items: center; }
.org-hijos { display: flex; justify-content: center; position: relative; padding-top: 22px; }
.org-hijos::before { content: ""; position: absolute; top: 0; left: 50%; width: 0; height: 22px; border-left: 2px solid #b3c0cb; }
.org-rama { position: relative; padding: 22px 9px 0; display: flex; flex-direction: column; align-items: center; }
.org-rama::before, .org-rama::after { content: ""; position: absolute; top: 0; width: 50%; height: 22px; border-top: 2px solid #b3c0cb; }
.org-rama::before { right: 50%; }
.org-rama::after { left: 50%; border-left: 2px solid #b3c0cb; }
.org-rama:first-child::before, .org-rama:last-child::after { border-top-color: transparent; }
.org-rama:only-child::before, .org-rama:only-child::after { border-top-color: transparent; }
.org-tarjeta { width: 168px; background: #fff; border: 1px solid #d5dde4; border-radius: 10px; padding: 0.6rem 0.5rem 0.45rem; text-align: center; box-shadow: 0 1px 2px rgba(18,32,46,0.06); position: relative; }
.org-tarjeta.yo { border: 2px solid #2F6F5E; }
.org-tarjeta.hallada { box-shadow: 0 0 0 3px #f5c542; }
.org-tarjeta.apagada { opacity: 0.4; }
.org-chip { display: inline-block; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 1px 7px; border-radius: 999px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.org-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem; margin: 0.35rem auto 0.3rem; }
.org-nombre { font-weight: 700; font-size: 0.88rem; color: #12202e; line-height: 1.2; overflow-wrap: anywhere; }
.org-nombre a { color: inherit; text-decoration: none; }
.org-nombre a:hover { text-decoration: underline; }
.org-puesto { font-size: 0.74rem; color: #6b727b; line-height: 1.25; margin-top: 2px; min-height: 0.9rem; overflow-wrap: anywhere; }
.org-abrir { margin-top: 0.4rem; padding: 0.1rem 0.6rem; font-size: 0.74rem; border-radius: 999px; border: 1px solid #b3c0cb; background: #fff; color: #163A5C; cursor: pointer; }
.org-abrir[aria-expanded="true"] { background: #163A5C; color: #fff; border-color: #163A5C; }
.org-hojas { display: grid; grid-template-columns: repeat(var(--cols), 148px); gap: 8px; background: #fff; border: 1px dashed #b3c0cb; border-radius: 10px; padding: 10px; }
.org-hoja { display: flex; gap: 0.45rem; align-items: center; text-align: left; border: 1px solid #e3e8ec; border-radius: 8px; padding: 0.3rem 0.4rem; background: #fff; min-width: 0; }
.org-hoja.yo { border: 2px solid #2F6F5E; }
.org-hoja.hallada { box-shadow: 0 0 0 3px #f5c542; }
.org-hoja.apagada { opacity: 0.4; }
.org-hoja .org-avatar { width: 30px; height: 30px; font-size: 0.72rem; margin: 0; flex-shrink: 0; }
.org-hoja .org-nombre { font-size: 0.78rem; font-weight: 600; }
.org-hoja .org-puesto { font-size: 0.68rem; min-height: 0; }
.org-barra { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.6rem; }
.org-barra button { padding: 0.25rem 0.7rem; font-size: 0.85rem; background: #fff; color: #163A5C; border: 1px solid #163A5C; border-radius: 6px; cursor: pointer; }
.org-barra input { padding: 0.35rem 0.6rem; font-size: 0.9rem; border: 1px solid #b9c4cd; border-radius: 6px; min-width: 0; flex: 1 1 180px; max-width: 280px; }
@media (max-width: 640px) { .org-tarjeta { width: 138px; } .org-hojas { grid-template-columns: repeat(min(var(--cols), 2), 132px); } .org-lienzo { padding: 0.7rem; max-height: none; } }
@media print { .org-barra { display: none !important; } .org-lienzo { overflow: visible; max-height: none; border: 0; background: #fff; } }
`;

export default function Arbol({ personas, yoId, enlace }: { personas: PersonaArbol[]; yoId?: string; enlace?: (p: PersonaArbol) => string | null }) {
  const [buscar, setBuscar] = useState("");
  const [zoom, setZoom] = useState(1);
  const lienzo = useRef<HTMLDivElement>(null);
  const { raices, sueltos, jefeDe } = useMemo(() => {
    // armarArbol ordena por `nombre`: se le pasa "Apellido, Nombre" para el
    // orden y se guarda el nombre de pila aparte, para mostrarlo.
    const a = armarArbol(personas.map((p): P => ({ ...p, pila: p.nombre, nombre: `${p.apellido}, ${p.nombre}` })));
    return { ...a, jefeDe: new Map(personas.map((p) => [p.id, p.jefeId])) };
  }, [personas]);

  // De entrada: los dos primeros niveles abiertos, y el camino hasta "yo".
  const inicial = useMemo(() => {
    const abiertos = new Set<string>();
    for (const r of raices) { abiertos.add(r.persona.id); if (raices.length === 1) for (const h of r.hijos) if (h.hijos.length && r.hijos.length <= 6) abiertos.add(h.persona.id); }
    if (yoId) { abiertos.add(yoId); for (const j of cadenaDeMando(yoId, jefeDe)) abiertos.add(j); }
    return abiertos;
  }, [raices, yoId, jefeDe]);
  const [abiertos, setAbiertos] = useState<Set<string>>(inicial);
  useEffect(() => { setAbiertos(inicial); }, [inicial]);

  const q = plano(buscar.trim());
  const hallados = useMemo(() => new Set(q.length < 2 ? [] : personas.filter((p) => plano(`${p.nombre} ${p.apellido} ${p.puesto ?? ""} ${p.sector ?? ""}`).includes(q)).map((p) => p.id)), [q, personas]);
  // Al buscar, se abre el camino hasta cada resultado.
  const visibles = useMemo(() => { const s = new Set(abiertos); for (const id of hallados) for (const j of cadenaDeMando(id, jefeDe)) s.add(j); return s; }, [abiertos, hallados, jefeDe]);
  useEffect(() => { if (hallados.size) lienzo.current?.querySelector(".hallada")?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); }, [hallados]);
  // Arranca centrado: en la persona (portal) o en quien está arriba de todo.
  // Solo mueve el lienzo, no la página.
  const centrar = (selector: string) => { const l = lienzo.current, t = l?.querySelector<HTMLElement>(selector); if (!l || !t) return; const a = t.getBoundingClientRect(), b = l.getBoundingClientRect(); l.scrollLeft += a.left + a.width / 2 - (b.left + b.width / 2); if (selector === ".yo") l.scrollTop += a.top + a.height / 2 - (b.top + b.height / 2); };
  useEffect(() => { centrar(yoId ? ".yo" : ".org-tarjeta"); }, [yoId, raices, abiertos, zoom]);

  const alternar = (id: string) => setAbiertos((s) => { const n = new Set(visibles); void s; n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todos = () => setAbiertos(new Set(personas.map((p) => p.id)));
  const clase = (id: string) => `${id === yoId ? " yo" : ""}${hallados.has(id) ? " hallada" : ""}${hallados.size > 0 && !hallados.has(id) ? " apagada" : ""}`;
  const nombre = (p: P) => { const h = enlace?.({ ...p, nombre: p.pila }); const t = `${p.pila} ${p.apellido}`; return h ? <a href={h}>{t}</a> : t; };
  const avatar = (p: P) => { const [fondo, tinta] = tono(p.sector); return <div className="org-avatar" style={{ background: fondo, color: tinta }} aria-hidden="true">{iniciales(p.pila, p.apellido)}</div>; };

  const Tarjeta = ({ n }: { n: NodoOrg<P> }) => {
    const p = n.persona, [fondo, tinta] = tono(p.sector), abierto = visibles.has(p.id);
    return (
      <div className={`org-tarjeta${clase(p.id)}`}>
        {p.sector && <span className="org-chip" style={{ background: fondo, color: tinta }}>{p.sector}</span>}
        {avatar(p)}
        <div className="org-nombre">{nombre(p)}{p.id === yoId && " (vos)"}</div>
        <div className="org-puesto">{p.puesto ?? ""}</div>
        {n.hijos.length > 0 && <button className="org-abrir" aria-expanded={abierto} onClick={() => alternar(p.id)} title={abierto ? "Ocultar a su equipo" : "Ver a su equipo"}>👥 {n.total} {abierto ? "▴" : "▾"}</button>}
      </div>
    );
  };
  const Nodo = ({ n }: { n: NodoOrg<P> }) => {
    const ramas = n.hijos.filter((h) => h.hijos.length > 0), hojas = n.hijos.filter((h) => h.hijos.length === 0);
    return (
      <div className="org-nodo">
        <Tarjeta n={n} />
        {visibles.has(n.persona.id) && n.hijos.length > 0 && (
          <div className="org-hijos">
            {ramas.map((h) => <div key={h.persona.id} className="org-rama"><Nodo n={h} /></div>)}
            {hojas.length > 0 && (
              <div className="org-rama">
                <div className="org-hojas" style={{ ["--cols" as any]: Math.min(4, Math.max(1, Math.ceil(Math.sqrt(hojas.length)))) }}>
                  {hojas.map((h) => <div key={h.persona.id} className={`org-hoja${clase(h.persona.id)}`}>{avatar(h.persona)}<div style={{ minWidth: 0 }}><div className="org-nombre">{nombre(h.persona)}{h.persona.id === yoId && " (vos)"}</div><div className="org-puesto">{h.persona.puesto ?? h.persona.sector ?? ""}</div></div></div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (raices.length === 0) return <p style={{ color: "#6b727b" }}>Todavía no hay una estructura cargada: ningún legajo tiene indicado a quién reporta.</p>;
  return (
    <div>
      {/* Como HTML crudo: si no, las comillas del CSS se escapan distinto en el servidor y en el navegador. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="org-barra">
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar persona, puesto o sector" aria-label="Buscar en el organigrama" />
        {hallados.size > 0 && <span style={{ fontSize: "0.85rem", color: "#6b727b" }}>{hallados.size} {hallados.size === 1 ? "resultado" : "resultados"}</span>}
        {q.length >= 2 && hallados.size === 0 && <span style={{ fontSize: "0.85rem", color: "#8a5413" }}>Sin resultados</span>}
        <button onClick={todos}>Abrir todo</button>
        <button onClick={() => setAbiertos(new Set(raices.map((r) => r.persona.id)))}>Cerrar</button>
        <button onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))} aria-label="Alejar">−</button>
        <span style={{ fontSize: "0.82rem", color: "#6b727b", minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)} %</span>
        <button onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.15) * 100) / 100))} aria-label="Acercar">+</button>
      </div>
      <div className="org-lienzo" ref={lienzo}>
        <div className="org-arbol" style={{ zoom } as React.CSSProperties}>
          <div style={{ display: "flex", gap: "2.5rem", alignItems: "flex-start" }}>{raices.map((r) => <Nodo key={r.persona.id} n={r} />)}</div>
        </div>
      </div>
      {sueltos.length > 0 && (
        <p style={{ fontSize: "0.88rem", color: "#4A4F58", marginTop: "0.6rem" }}>
          <strong>Sin ubicar en el organigrama ({sueltos.length}):</strong> {sueltos.map((s, i) => <span key={s.id} style={hallados.has(s.id) ? { background: "#fff3c4" } : undefined}>{i > 0 && " · "}{s.pila} {s.apellido}</span>)}. No tienen jefe ni gente a cargo.
        </p>
      )}
    </div>
  );
}
