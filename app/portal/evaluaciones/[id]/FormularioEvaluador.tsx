"use client";
// El jefe puntúa cada competencia de 1 a 5 y escribe fortalezas y qué
// mejorar. Puede guardar un borrador y terminar después.
import { useState } from "react";
import { ESCALA, type Competencia } from "@/lib/evaluaciones-reglas";

export default function FormularioEvaluador({ id, competencias, inicial, completada, auto, autoComentario, esperaAuto }: { id: string; competencias: Competencia[]; inicial: { puntajes: Record<string, number>; fortalezas: string; aMejorar: string }; completada: boolean; auto?: Record<string, number> | null; autoComentario?: string | null; esperaAuto?: boolean }) {
  const [f, setF] = useState(inicial);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(accion: "guardar" | "completar") {
    if (enviando) return;
    setEnviando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/portal/evaluaciones/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion, ...f }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, texto: d.error || "No se pudo guardar." }); setEnviando(false); return; }
      if (accion === "completar") { window.location.href = "/portal/evaluaciones"; return; }
      setMsg({ ok: true, texto: "Borrador guardado. Podés terminarla después." });
    } catch {
      setMsg({ ok: false, texto: "No hay conexión. Probá de nuevo." });
    }
    setEnviando(false);
  }

  return (
    <>
      {completada && <div className="p-aviso ok">Ya la completaste. La podés corregir hasta que RR.HH. se la entregue.</div>}
      {esperaAuto && <div className="p-aviso info">Todavía no hizo su autoevaluación. Podés completar la tuya igual.</div>}
      {auto && autoComentario && <div className="p-card"><div className="p-card-titulo">Lo que escribió en su autoevaluación</div><div className="p-card-dato" style={{ whiteSpace: "pre-wrap" }}>{autoComentario}</div></div>}
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
          <div className="p-card-dato" style={{ minHeight: "1.2em", color: "#6b727b" }}>{f.puntajes[i] ? ESCALA[f.puntajes[i]].nombre : "1 = no cumple · 5 = sobresaliente"}{auto?.[i] && <span style={{ color: "#163A5C" }}> · se puso {auto[i]}</span>}</div>
        </div>
      ))}
      <label className="p-campo">Fortalezas<textarea rows={3} maxLength={1500} value={f.fortalezas} onChange={(e) => setF({ ...f, fortalezas: e.target.value })} placeholder="Lo que hace bien y conviene que siga haciendo" /></label>
      <label className="p-campo">A mejorar<textarea rows={3} maxLength={1500} value={f.aMejorar} onChange={(e) => setF({ ...f, aMejorar: e.target.value })} placeholder="Qué se espera que cambie de acá a la próxima evaluación" /></label>
      {msg && <div className={`p-aviso ${msg.ok ? "ok" : "error"}`} role="alert">{msg.texto}</div>}
      <button className="p-btn" onClick={() => enviar("completar")} disabled={enviando}>{completada ? "Guardar los cambios" : "Completar evaluación"}</button>
      {!completada && <button className="p-btn sec" onClick={() => enviar("guardar")} disabled={enviando}>Guardar borrador</button>}
      <p className="p-pie">El empleado la ve recién cuando RR.HH. se la entrega.</p>
    </>
  );
}
