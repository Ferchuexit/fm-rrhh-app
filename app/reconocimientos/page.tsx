"use client";
// FM RRHH — app/reconocimientos/page.tsx
// Reconocimientos visto por RR.HH.: cómo se está usando, el muro completo
// (con la posibilidad de sacar uno), reconocer en nombre de la empresa y
// definir los valores.
import { useEffect, useState } from "react";

type Valor = { nombre: string; emoji: string };
type Rec = { id: string; para: string; sector: string | null; de: string; deRRHH: boolean; valor: string; emoji: string; mensaje: string; oculto: boolean; aplausos: number; createdAt: string };
type Conteo = { clave: string; cantidad: number; nombre?: string };
type Datos = { valores: Valor[]; tope: number; legajos: { id: string; nombre: string; sector: string }[]; reconocimientos: Rec[]; resumen: { total: number; porValor: Conteo[]; masReconocidos: Conteo[]; masReconocen: Conteo[]; reconocidos: number; emisores: number; alcance: number | null } };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1000px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const rotulo: React.CSSProperties = { fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b727b", marginBottom: 4 };

async function enviar(cuerpo: unknown) {
  const res = await fetch("/api/reconocimientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function ReconocimientosPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState<{ paraId: string; valor: string; mensaje: string } | null>(null);
  const [errorNuevo, setErrorNuevo] = useState("");
  const [valores, setValores] = useState<Valor[] | null>(null);
  const [errorValores, setErrorValores] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  async function cargar() {
    const res = await fetch("/api/reconocimientos");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  async function crear() {
    if (!nuevo) return;
    setErrorNuevo("");
    const r = await enviar(nuevo);
    if (!r.ok) { setErrorNuevo(r.d.error ?? "No se pudo guardar."); return; }
    setNuevo(null);
    cargar();
  }
  async function ocultar(r: Rec) {
    const res = await enviar({ accion: r.oculto ? "mostrar" : "ocultar", id: r.id });
    if (!res.ok) setError(res.d.error ?? "No se pudo guardar.");
    cargar();
  }
  async function guardarValores() {
    if (!valores) return;
    setErrorValores("");
    const r = await enviar({ accion: "valores", valores });
    if (!r.ok) { setErrorValores(r.d.error ?? "No se pudo guardar."); return; }
    setValores(null);
    cargar();
  }

  const barras = (titulo: string, lista: Conteo[], max: number) => lista.length > 0 && (
    <div style={{ minWidth: 250, flex: 1 }}>
      <div style={rotulo}>{titulo}</div>
      {lista.map((x) => (
        <div key={x.clave} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", marginBottom: 3 }}>
          <span style={{ width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nombre ?? `${datos?.valores.find((v) => v.nombre === x.clave)?.emoji ?? ""} ${x.clave}`}</span>
          <span style={{ width: 70, height: 8, background: "#EEF1F4" }}><span style={{ display: "block", width: `${(x.cantidad / max) * 100}%`, height: 8, background: "#163A5C" }} /></span>
          <strong>{x.cantidad}</strong>
        </div>
      ))}
    </div>
  );

  return (
    <main>
      <h1>Reconocimientos</h1>
      <p style={{ maxWidth: "860px" }}>
        Cualquier empleado reconoce a un compañero desde el portal, por uno de los <strong>valores de la empresa</strong> y contando qué hizo. Se publica en el muro, con nombre, y el
        reconocido recibe un aviso. Cada persona puede dar hasta {datos?.tope ?? 5} por mes.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          <div style={caja}>
            <strong style={{ color: "#163A5C" }}>Últimos 90 días</strong>
            {datos.resumen.total === 0 ? <p style={{ margin: "0.4rem 0 0", color: "#4A4F58" }}>Todavía no hay reconocimientos. Suele arrancar cuando RR.HH. o los jefes dan los primeros: probá con «Reconocer a alguien».</p> : (
              <>
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", margin: "0.5rem 0 0.9rem" }}>
                  <div><span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#163A5C" }}>{datos.resumen.total}</span> <span style={{ fontSize: "0.85rem", color: "#6b727b" }}>reconocimientos</span></div>
                  <div><span style={{ fontSize: "1.6rem", fontWeight: 700, color: (datos.resumen.alcance ?? 0) >= 50 ? "#2F6F5E" : "#B8752B" }}>{datos.resumen.alcance ?? 0}%</span> <span style={{ fontSize: "0.85rem", color: "#6b727b" }}>de la gente recibió al menos uno ({datos.resumen.reconocidos} de {datos.legajos.length})</span></div>
                  <div><span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#163A5C" }}>{datos.resumen.emisores}</span> <span style={{ fontSize: "0.85rem", color: "#6b727b" }}>personas reconocieron a alguien</span></div>
                </div>
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                  {barras("Por valor", datos.resumen.porValor, datos.resumen.porValor[0]?.cantidad ?? 1)}
                  {barras("Los más reconocidos", datos.resumen.masReconocidos, datos.resumen.masReconocidos[0]?.cantidad ?? 1)}
                  {barras("Los que más reconocen", datos.resumen.masReconocen, datos.resumen.masReconocen[0]?.cantidad ?? 1)}
                </div>
              </>
            )}
          </div>

          {!nuevo && <p><button onClick={() => { setErrorNuevo(""); setNuevo({ paraId: "", valor: "", mensaje: "" }); }}>👏 Reconocer a alguien</button> <span style={{ fontSize: "0.85rem", color: "#6b727b" }}>en nombre de la empresa</span></p>}
          {nuevo && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>Reconocimiento de la empresa</strong>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                <label>A quién<br /><select value={nuevo.paraId} onChange={(e) => setNuevo({ ...nuevo, paraId: e.target.value })}><option value="">Elegir…</option>{datos.legajos.map((l) => <option key={l.id} value={l.id}>{l.nombre} · {l.sector}</option>)}</select></label>
                <label>Por qué valor<br /><select value={nuevo.valor} onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })}><option value="">Elegir…</option>{datos.valores.map((v) => <option key={v.nombre} value={v.nombre}>{v.emoji} {v.nombre}</option>)}</select></label>
              </div>
              <label style={{ display: "block", marginTop: "0.6rem" }}>Qué hizo<br /><textarea rows={3} maxLength={500} value={nuevo.mensaje} onChange={(e) => setNuevo({ ...nuevo, mensaje: e.target.value })} style={{ width: "100%", maxWidth: 760 }} placeholder="El ejemplo concreto: qué pasó, qué hizo, qué evitó o logró." /></label>
              {errorNuevo && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorNuevo}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}><button onClick={crear}>Publicar en el muro</button><button onClick={() => setNuevo(null)} style={btnSec}>Cancelar</button></div>
            </div>
          )}

          <h2>Muro ({datos.reconocimientos.length})</h2>
          {(verTodos ? datos.reconocimientos : datos.reconocimientos.slice(0, 20)).map((r) => (
            <div key={r.id} style={{ ...caja, marginBottom: "0.5rem", opacity: r.oculto ? 0.55 : 1, borderLeft: `4px solid ${r.oculto ? "#9aa5b1" : "#7FA8C6"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: "1.2rem" }}>{r.emoji}</span> <strong style={{ color: "#163A5C" }}>{r.para}</strong>{r.sector && <span style={{ color: "#6b727b" }}> · {r.sector}</span>} <span style={{ color: "#6b727b" }}>— {r.valor}</span>
                  <div style={{ whiteSpace: "pre-wrap", margin: "0.3rem 0" }}>{r.mensaje}</div>
                  <div style={{ fontSize: "0.8rem", color: "#6b727b" }}>De {r.de}{r.deRRHH && " (la empresa)"} · {dia(r.createdAt)} · 👏 {r.aplausos}{r.oculto && <strong style={{ color: "#B23A3A" }}> · Oculto: no se ve en el muro</strong>}</div>
                </div>
                <button onClick={() => ocultar(r)} style={{ ...btnSec, ...chico, ...(r.oculto ? {} : { color: "#B23A3A", borderColor: "#B23A3A" }) }}>{r.oculto ? "Volver a mostrar" : "Ocultar"}</button>
              </div>
            </div>
          ))}
          {!verTodos && datos.reconocimientos.length > 20 && <p><button onClick={() => setVerTodos(true)} style={btnSec}>Ver los {datos.reconocimientos.length}</button></p>}

          <h2 style={{ marginTop: "1.5rem" }}>Valores de la empresa</h2>
          <div style={caja}>
            {!valores ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>{datos.valores.map((v) => <span key={v.nombre} style={{ border: "1px solid #dfe4e8", borderRadius: 999, padding: "0.25rem 0.7rem" }}>{v.emoji} {v.nombre}</span>)}</div>
                <button onClick={() => { setErrorValores(""); setValores(datos.valores.map((v) => ({ ...v }))); }} style={{ ...btnSec, marginTop: "0.7rem" }}>Editar los valores</button>
              </>
            ) : (
              <>
                {valores.map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.3rem" }}>
                    <input value={v.emoji} onChange={(e) => setValores(valores.map((x, k) => (k === i ? { ...x, emoji: e.target.value } : x)))} style={{ width: 50, textAlign: "center" }} aria-label="Emoji" />
                    <input value={v.nombre} maxLength={30} onChange={(e) => setValores(valores.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} style={{ width: 240 }} aria-label="Nombre del valor" />
                    <button onClick={() => setValores(valores.filter((_, k) => k !== i))} style={{ ...btnSec, ...chico }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setValores([...valores, { nombre: "", emoji: "⭐" }])} style={{ ...btnSec, ...chico }}>+ Valor</button>
                {errorValores && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorValores}</p>}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}><button onClick={guardarValores}>Guardar</button><button onClick={() => setValores(null)} style={btnSec}>Cancelar</button></div>
              </>
            )}
            <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.6rem 0 0" }}>Pocos y propios: los que de verdad querés ver en la planta. Los reconocimientos ya dados conservan el valor con el que se dieron.</p>
          </div>
        </>
      )}
    </main>
  );
}
