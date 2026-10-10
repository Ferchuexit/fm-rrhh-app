"use client";
// La autoevaluación: el empleado se puntúa en las mismas competencias que
// después usa su jefe. No hay borrador: son pocas y se puede corregir.
import { useState } from "react";
import { ESCALA, type Competencia } from "@/lib/evaluaciones-reglas";

export default function FormularioAuto({ id, competencias, inicial, completada }: { id: string; competencias: Competencia[]; inicial: { puntajes: Record<string, number>; comentario: string }; completada: boolean }) {
  const [f, setF] = useState(inicial);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/evaluaciones/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "autoevaluar", ...f }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "No se pudo guardar."); setEnviando(false); return; }
      window.location.href = "/portal/evaluaciones";
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <>
      <div className={`p-aviso ${completada ? "ok" : "info"}`}>{completada ? "Ya la completaste. La podés corregir hasta que te entreguen tu evaluación." : "Puntuate vos en cada punto. Tu jefe la ve cuando hace tu evaluación: sirve para charlar las diferencias."}</div>
      {competencias.map((c, i) => (
        <div key={i} className="p-card">
          <div className="p-card-titulo">{c.nombre}</div>
          {c.descripcion && <div className="p-card-dato">{c.descripcion}</div>}
          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.6rem" }} role="radiogroup" aria-label={c.nombre}>
            {[1, 2, 3, 4, 5].map((n) => {
              const elegido = f.puntajes[i] === n;
              return <button key={n} type="button" role="radio" aria-checked={elegido} onClick={() => setF({ ...f, puntajes: { ...f.puntajes, [i]: n } })} style={{ flex: 1, minHeight: 46, fontSize: "1.1rem", fontWeight: 700, borderRadius: 8, cursor: "pointer", border: elegido ? "2px solid #12202e" : "1px solid #b9c4cd", background: elegido ? ESCALA[n].color : "#fff", color: elegido && n === 5 ? "#fff" : "#12202e" }}>{n}</button>;
            })}
          </div>
          <div className="p-card-dato" style={{ minHeight: "1.2em", color: "#6b727b" }}>{f.puntajes[i] ? ESCALA[f.puntajes[i]].nombre : "1 = no cumple · 5 = sobresaliente"}</div>
        </div>
      ))}
      <label className="p-campo">Algo que quieras contar (opcional)<textarea rows={3} maxLength={1500} value={f.comentario} onChange={(e) => setF({ ...f, comentario: e.target.value })} placeholder="Logros del año, qué te gustaría aprender, qué necesitás para trabajar mejor" /></label>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" onClick={enviar} disabled={enviando}>{completada ? "Guardar los cambios" : "Enviar mi autoevaluación"}</button>
    </>
  );
}
