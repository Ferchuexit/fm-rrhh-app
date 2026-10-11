"use client";
// FM RRHH — app/organigrama/page.tsx
// El organigrama de la empresa, para consultar. Dos vistas: por puestos
// (quién ocupa cada uno, y las vacantes) y por personas (quién reporta a
// quién). Se edita en Puestos y en el legajo de cada persona.
import { useEffect, useState } from "react";
import Arbol, { type PersonaArbol } from "./Arbol";
import Editor, { type Gente } from "./Editor";

type Persona = { id: string; nombre: string; sector: string | null };
type Puesto = { id: string; nombre: string; sector: string | null; mision: string | null; nivel: number; dotacion: number; vacantes: number; aCargo: number; ocupantes: Persona[] };
type Datos = { gente: (PersonaArbol & Gente)[]; sectores: { id: string; nombre: string }[]; listaPuestos: { id: string; nombre: string }[]; dotacion: number; puestos: Puesto[]; sinPuesto: Persona[]; personas: (Persona & { nivel: number; aCargo: number })[]; sinJefe: Persona[] };

const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const COLORES = ["#163A5C", "#2F6F5E", "#6B4E9B", "#B8752B", "#4A7A8C", "#8a5413"];
const sangria = (nivel: number): React.CSSProperties => ({ marginLeft: Math.min(nivel, 8) * 34 });

export default function OrganigramaPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<"arbol" | "puestos" | "editar">("arbol");
  const [buscar, setBuscar] = useState("");

  async function cargar() {
    const res = await fetch("/api/organigrama");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  const q = buscar.trim().toLowerCase();
  const coincide = (t: string | null) => !!q && !!t && t.toLowerCase().includes(q);
  const marca = (si: boolean): React.CSSProperties => (si ? { background: "#fff3c4", borderRadius: 3, padding: "0 2px" } : {});
  const vacantes = datos?.puestos.reduce((a, p) => a + p.vacantes, 0) ?? 0;

  return (
    <main>
      <h1>Organigrama</h1>
      <p style={{ maxWidth: "860px" }}>
        Cómo está armada la empresa: quién reporta a quién, qué puesto ocupa cada uno y dónde hay vacantes. Se actualiza solo cuando cambia un legajo; desde "Armar la estructura" se acomoda a varios de una vez.
        Los empleados lo ven desde el portal, en Organigrama.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && (
        <>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.8rem" }}>
            <button onClick={() => setVista("arbol")} style={vista === "arbol" ? {} : btnSec}>Organigrama</button>
            <button onClick={() => setVista("puestos")} style={vista === "puestos" ? {} : btnSec}>Puestos y vacantes</button>
            <button onClick={() => setVista("editar")} style={vista === "editar" ? {} : btnSec}>Armar la estructura</button>
            {vista === "puestos" && <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar una persona o un puesto" aria-label="Buscar en los puestos" style={{ width: 260 }} />}
            <span style={{ color: "#4A4F58", fontSize: "0.9rem" }}>{datos.dotacion} personas · {datos.puestos.length} puestos{vacantes > 0 && <strong style={{ color: "#8a5413" }}> · {vacantes} {vacantes === 1 ? "vacante" : "vacantes"}</strong>}</span>
            <button onClick={() => window.print()} style={btnSec}>Imprimir</button>
          </div>

          {vista === "puestos" && (
            datos.puestos.length === 0 ? <p style={{ color: "#6b727b" }}>Todavía no hay puestos cargados. Se cargan en <a href="/puestos">Desarrollo de talento → Puestos</a>. Mientras tanto, mirá la vista por personas.</p> : (
              <div style={{ maxWidth: 980 }}>
                {datos.puestos.map((p) => (
                  <div key={p.id} style={{ ...sangria(p.nivel), background: "white", border: "1px solid #dfe4e8", borderLeft: `5px solid ${COLORES[p.nivel % COLORES.length]}`, padding: "0.55rem 0.8rem", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                      <span><strong style={{ color: "#163A5C", ...marca(coincide(p.nombre)) }}>{p.nombre}</strong>{p.sector && <span style={{ color: "#6b727b", fontSize: "0.85rem" }}> · {p.sector}</span>}</span>
                      <span style={{ fontSize: "0.8rem", color: "#6b727b" }}>{p.ocupantes.length} de {p.dotacion}{p.aCargo > 0 && ` · ${p.aCargo} a cargo`}{p.vacantes > 0 && <strong style={{ color: "#8a5413" }}> · {p.vacantes} {p.vacantes === 1 ? "vacante" : "vacantes"}</strong>}</span>
                    </div>
                    <div style={{ fontSize: "0.92rem", marginTop: 2 }}>{p.ocupantes.length === 0 ? <span style={{ color: "#8a5413" }}>Sin ocupar</span> : p.ocupantes.map((o, i) => <span key={o.id}>{i > 0 && " · "}<span style={marca(coincide(o.nombre))}>{o.nombre}</span></span>)}</div>
                  </div>
                ))}
                {datos.sinPuesto.length > 0 && <p style={{ fontSize: "0.9rem", color: "#4A4F58" }}><strong>Sin puesto asignado ({datos.sinPuesto.length}):</strong> {datos.sinPuesto.map((o, i) => <span key={o.id}>{i > 0 && " · "}<span style={marca(coincide(o.nombre))}>{o.nombre}</span></span>)}. Se asignan en <a href="/puestos">Puestos</a>.</p>}
              </div>
            )
          )}

          {vista === "arbol" && (
            datos.gente.some((g) => g.jefeId) ? <Arbol personas={datos.gente} /> : (
              <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", maxWidth: 800 }}>
                <strong style={{ color: "#163A5C" }}>Todavía no hay estructura para dibujar</strong>
                <p style={{ margin: "0.3rem 0 0.7rem" }}>El organigrama se arma con el dato "a quién reporta" de cada persona, y hoy nadie lo tiene cargado. Hay dos formas rápidas de hacerlo, sin entrar legajo por legajo:</p>
                <button onClick={() => setVista("editar")}>Armar la estructura acá</button> <a href="/legajos/importar"><button style={btnSec}>Cargarla desde un Excel</button></a>
              </div>
            )
          )}

          {vista === "editar" && <Editor gente={datos.gente} sectores={datos.sectores} puestos={datos.listaPuestos} alGuardar={cargar} />}
        </>
      )}
    </main>
  );
}
