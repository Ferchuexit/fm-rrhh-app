"use client";
// FM RRHH — app/reclamos/page.tsx
// Reclamos de haberes que hacen los empleados desde el portal:
//   - Pendientes: se revisan contra el recibo y se responden. Lo que se
//     aprueba puede entrar directo como novedad en un período abierto.
//   - Respondidos: el historial.
//   - Motivos: la lista que el empleado ve para elegir.
import { useEffect, useState } from "react";
import { textoCantidad, ESTADOS_RECLAMO, UNIDADES, MOTIVOS_ESTANDAR, type ItemReclamo, type Motivo, type Unidad } from "@/lib/reclamos-reglas";

type Reclamo = { id: string; legajoId: string; legajo: number; nombre: string; sector: string; periodoNombre: string | null; items: ItemReclamo[]; comentario: string | null; estado: string; respuesta: string | null; periodoAjuste: string | null; novedades: number; resueltoPor: string | null; resueltoEn: string | null; createdAt: string; liquidacionId: string | null };
type Contexto = { recibo: { periodoId: string; bruto: number; neto: number; lineas: { codigo: string; nombre: string; tipo: string; importe: number }[] } | null; conceptos: { codigo: string; nombre: string; unidad: string }[]; periodos: { id: string; nombre: string }[] };
type Decision = { aprobado: boolean; cantidad: string; conceptoCodigo: string };

const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1100px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.55rem", fontSize: "0.82rem" };
const gris: React.CSSProperties = { color: "#6b727b", fontSize: "0.85rem" };
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "");
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const COLOR: Record<string, string> = { pendiente: "#8a5413", aprobado: "#2F6F5E", parcial: "#8a5413", rechazado: "#B23A3A" };

async function pedir(cuerpo: unknown) {
  const res = await fetch("/api/reclamos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function ReclamosPage() {
  const [datos, setDatos] = useState<{ reclamos: Reclamo[]; motivos: Motivo[]; propios: boolean } | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [vista, setVista] = useState<"pendientes" | "respondidos" | "motivos">("pendientes");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [decisiones, setDecisiones] = useState<Decision[]>([]);
  const [respuesta, setRespuesta] = useState("");
  const [periodoId, setPeriodoId] = useState("");
  const [errorResp, setErrorResp] = useState("");
  const [motivos, setMotivos] = useState<Motivo[] | null>(null);
  const [errorMotivos, setErrorMotivos] = useState("");

  async function cargar() {
    const res = await fetch("/api/reclamos");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError(""); setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  async function abrir(r: Reclamo) {
    setErrorResp(""); setCtx(null);
    if (abierto === r.id) { setAbierto(null); return; }
    setAbierto(r.id); setRespuesta("");
    const res = await fetch(`/api/reclamos/${r.id}`);
    const c: Contexto = await res.json().catch(() => null);
    if (!res.ok || !c) { setErrorResp("No se pudo cargar el recibo."); return; }
    setCtx(c);
    setPeriodoId(c.periodos[0]?.id ?? "");
    // De entrada: corresponde todo lo reclamado, con el concepto sugerido si existe.
    setDecisiones(r.items.map((it) => {
      const sugerido = datos?.motivos.find((m) => m.id === it.motivoId)?.concepto ?? MOTIVOS_ESTANDAR.find((m) => m.id === it.motivoId)?.concepto ?? "";
      return { aprobado: true, cantidad: it.cantidad !== null ? String(it.cantidad).replace(".", ",") : "", conceptoCodigo: c.conceptos.some((x) => x.codigo === sugerido) ? sugerido! : "" };
    }));
  }
  async function responder(r: Reclamo) {
    setErrorResp(""); setMsg("");
    const res = await pedir({ accion: "resolver", id: r.id, items: decisiones, respuesta, periodoId });
    if (!res.ok) { setErrorResp(res.d.error ?? "No se pudo guardar."); return; }
    setMsg(`Respuesta enviada a ${r.nombre} (${ESTADOS_RECLAMO[res.d.estado].toLowerCase()}). Le llegó el aviso al portal.`);
    setAbierto(null); cargar();
  }
  async function guardarMotivos(restaurar = false) {
    setErrorMotivos(""); setMsg("");
    const res = await pedir(restaurar ? { accion: "motivos", restaurar: true } : { accion: "motivos", motivos });
    if (!res.ok) { setErrorMotivos(res.d.error ?? "No se pudo guardar."); return; }
    setMsg(restaurar ? "Se volvió a la lista estándar." : "Lista de motivos guardada: es la que ven los empleados desde ahora.");
    setMotivos(null); cargar();
  }

  const pendientes = datos?.reclamos.filter((r) => r.estado === "pendiente") ?? [];
  const respondidos = datos?.reclamos.filter((r) => r.estado !== "pendiente") ?? [];
  const lista = vista === "pendientes" ? pendientes : respondidos;
  const algunaNovedad = decisiones.some((d) => d.aprobado && d.conceptoCodigo);
  const todoAprobado = decisiones.length > 0 && decisiones.every((d) => d.aprobado);

  return (
    <main>
      <h1>Reclamos de haberes</h1>
      <p style={{ maxWidth: 900 }}>
        Lo que los empleados reclaman de sus recibos desde el portal: horas que faltaron, un premio, un descuento que no corresponde. Revisalo contra el recibo, decidí ítem por ítem y respondé.
        Lo que se aprueba puede entrar directo como novedad en un período abierto.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {msg && <p style={{ color: "#2F6F5E", maxWidth: 900 }}>{msg}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && (
        <>
          <p>
            <button onClick={() => setVista("pendientes")} style={vista === "pendientes" ? {} : btnSec}>Pendientes ({pendientes.length})</button>{" "}
            <button onClick={() => setVista("respondidos")} style={vista === "respondidos" ? {} : btnSec}>Respondidos</button>{" "}
            <button onClick={() => { setVista("motivos"); setMotivos(datos.motivos.map((m) => ({ ...m }))); }} style={vista === "motivos" ? {} : btnSec}>Motivos</button>
          </p>

          {vista !== "motivos" && lista.length === 0 && <p style={gris}>{vista === "pendientes" ? "No hay reclamos esperando respuesta." : "Todavía no se respondió ninguno."}</p>}
          {vista !== "motivos" && lista.map((r) => (
            <div key={r.id} style={{ ...caja, padding: "0.75rem 1rem", borderLeft: `4px solid ${COLOR[r.estado] ?? "#c3d0da"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
                <div><strong>{r.nombre}</strong> <span style={gris}>· Leg. {r.legajo} · {r.sector} · {r.periodoNombre ? `recibo ${r.periodoNombre}` : "reclamo general"} · {dia(r.createdAt)}</span></div>
                <span style={{ fontSize: "0.85rem", color: COLOR[r.estado] }}>{ESTADOS_RECLAMO[r.estado]}{r.resueltoEn && ` · ${dia(r.resueltoEn)} por ${r.resueltoPor}`}</span>
              </div>
              <ul style={{ margin: "0.4rem 0", paddingLeft: "1.2rem" }}>
                {r.items.map((it) => (
                  <li key={it.motivoId}>
                    <strong>{it.motivo}</strong>{it.cantidad !== null && `: ${textoCantidad(it.unidad, it.cantidad)}`}{it.detalle && <span style={gris}> — {it.detalle}</span>}
                    {r.estado !== "pendiente" && <span style={{ color: it.aprobado ? "#2F6F5E" : "#B23A3A", fontSize: "0.85rem" }}> · {it.aprobado ? `aprobado${it.cantidadAprobada != null ? ` ${textoCantidad(it.unidad, it.cantidadAprobada)}` : ""}${it.conceptoCodigo ? ` (novedad ${it.conceptoCodigo})` : ""}` : "no corresponde"}</span>}
                  </li>
                ))}
              </ul>
              {r.comentario && <div style={{ fontStyle: "italic", fontSize: "0.92rem" }}>“{r.comentario}”</div>}
              {r.estado !== "pendiente" && (r.respuesta || r.periodoAjuste) && <div style={{ ...gris, marginTop: 4 }}>Respuesta: {r.respuesta}{r.periodoAjuste && ` · se ajusta en ${r.periodoAjuste}`}{r.novedades ? ` · ${r.novedades} ${r.novedades === 1 ? "novedad cargada" : "novedades cargadas"}` : ""}</div>}
              {r.estado === "pendiente" && <p style={{ margin: "0.5rem 0 0" }}><button style={chico} onClick={() => abrir(r)}>{abierto === r.id ? "Cerrar" : "Revisar y responder"}</button></p>}

              {abierto === r.id && (
                <div style={{ marginTop: "0.7rem", borderTop: "1px solid #dfe4e8", paddingTop: "0.7rem" }}>
                  {!ctx ? <p>{errorResp || "Cargando…"}</p> : (
                    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ flex: "1 1 300px", maxWidth: 380 }}>
                        <strong style={{ color: "#163A5C" }}>Lo que dice el recibo</strong>
                        {!ctx.recibo ? <p style={gris}>No es sobre un recibo en particular.</p> : (
                          <>
                            <table style={{ fontSize: "0.85rem", marginTop: 4, width: "100%" }}>
                              <tbody>{ctx.recibo.lineas.map((l, i) => <tr key={i}><td>{l.nombre}</td><td style={{ textAlign: "right", whiteSpace: "nowrap", color: l.tipo === "descuento" ? "#B23A3A" : undefined }}>{l.tipo === "descuento" ? "−" : ""}{pesos(l.importe)}</td></tr>)}
                                <tr><td><strong>Neto</strong></td><td style={{ textAlign: "right" }}><strong>{pesos(ctx.recibo.neto)}</strong></td></tr></tbody>
                            </table>
                            <a href={`/api/recibo?legajoId=${r.legajoId}&periodoId=${ctx.recibo.periodoId}`} target="_blank" rel="noopener" style={{ fontSize: "0.85rem" }}>Ver el recibo (PDF)</a>
                          </>
                        )}
                        <p style={{ ...gris, marginTop: 6 }}><a href={`/legajos/${r.legajoId}`}>Abrir el legajo</a> · <a href="/asistencia">Asistencia</a> · <a href="/banco-horas">Banco de horas</a></p>
                      </div>
                      <div style={{ flex: "2 1 460px" }}>
                        <strong style={{ color: "#163A5C" }}>Tu respuesta, ítem por ítem</strong>
                        <table style={{ fontSize: "0.88rem", marginTop: 4 }}>
                          <thead><tr><th>Corresponde</th><th>Reclamo</th><th>Se aprueba</th><th>Cargar como novedad</th></tr></thead>
                          <tbody>{r.items.map((it, i) => {
                            const d = decisiones[i]; if (!d) return null;
                            const cambiar = (c: Partial<Decision>) => setDecisiones(decisiones.map((x, k) => (k === i ? { ...x, ...c } : x)));
                            return (
                              <tr key={it.motivoId} style={{ opacity: d.aprobado ? 1 : 0.55 }}>
                                <td style={{ textAlign: "center" }}><input type="checkbox" checked={d.aprobado} onChange={(e) => cambiar({ aprobado: e.target.checked })} aria-label={`Corresponde ${it.motivo}`} /></td>
                                <td>{it.motivo}{it.cantidad !== null && <div style={gris}>{textoCantidad(it.unidad, it.cantidad)}</div>}</td>
                                <td>{(it.unidad !== "texto" || d.conceptoCodigo) && <input value={d.cantidad} onChange={(e) => cambiar({ cantidad: e.target.value })} disabled={!d.aprobado} style={{ width: 95 }} aria-label="Cantidad aprobada" placeholder={it.unidad === "monto" ? "$" : it.unidad === "horas" ? "horas" : "días"} />}</td>
                                <td><select value={d.conceptoCodigo} onChange={(e) => cambiar({ conceptoCodigo: e.target.value })} disabled={!d.aprobado} style={{ maxWidth: 230 }}><option value="">No, lo ajusto a mano</option>{ctx.conceptos.map((c) => <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.unidad === "monto" ? "$" : c.unidad})</option>)}</select></td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                        {algunaNovedad && (ctx.periodos.length ? <p><label>Cargar las novedades en el período <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>{ctx.periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label></p> : <p style={{ color: "#B23A3A" }}>No hay ningún período abierto para su convenio: respondé sin novedad y cargala cuando abras el período.</p>)}
                        <label style={{ display: "block", marginTop: 6 }}>{todoAprobado ? "Mensaje para la persona (opcional)" : "Por qué no corresponde todo (lo lee la persona)"}<br />
                          <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={3} maxLength={1000} style={{ width: "100%", maxWidth: 620 }} placeholder={todoAprobado ? "Ej.: Tenías razón, faltaron las horas del sábado 3." : "Ej.: Las horas del 15/09 ya se pagaron en la quincena anterior."} />
                        </label>
                        {errorResp && <p style={{ color: "#B23A3A" }}>{errorResp}</p>}
                        <p style={{ display: "flex", gap: 6 }}><button onClick={() => responder(r)}>Enviar respuesta</button><button style={btnSec} onClick={() => setAbierto(null)}>Cancelar</button></p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {vista === "motivos" && motivos && (
            <div style={caja}>
              <p style={{ marginTop: 0 }}>La lista que el empleado ve para elegir qué reclama. {datos.propios ? "Esta empresa tiene su propia lista." : "Hoy se usa la lista estándar; podés adaptarla (por ejemplo, con los adicionales del convenio)."} El concepto es el que se sugiere al cargar la novedad cuando se aprueba.</p>
              <table style={{ fontSize: "0.9rem" }}>
                <thead><tr><th>Motivo</th><th>Qué pide</th><th>Concepto sugerido</th><th>Activo</th></tr></thead>
                <tbody>{motivos.map((m, i) => {
                  const cambiar = (c: Partial<Motivo>) => setMotivos(motivos.map((x, k) => (k === i ? { ...x, ...c } : x)));
                  return (
                    <tr key={i}>
                      <td><input value={m.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} style={{ width: 340 }} maxLength={90} aria-label="Nombre del motivo" /></td>
                      <td><select value={m.unidad} onChange={(e) => cambiar({ unidad: e.target.value as Unidad })}>{Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                      <td><input value={m.concepto ?? ""} onChange={(e) => cambiar({ concepto: e.target.value.toUpperCase() || null })} style={{ width: 150 }} placeholder="Ninguno" aria-label="Código de concepto" /></td>
                      <td style={{ textAlign: "center" }}><input type="checkbox" checked={m.activo} onChange={(e) => cambiar({ activo: e.target.checked })} aria-label="Activo" /></td>
                    </tr>
                  );
                })}</tbody>
              </table>
              <p><button style={{ ...btnSec, ...chico }} onClick={() => setMotivos([...motivos, { id: "", nombre: "", unidad: "horas", concepto: null, activo: true }])}>+ Agregar motivo</button></p>
              {errorMotivos && <p style={{ color: "#B23A3A" }}>{errorMotivos}</p>}
              <p style={{ display: "flex", gap: 6 }}>
                <button onClick={() => guardarMotivos()}>Guardar lista</button>
                {datos.propios && <button style={btnSec} onClick={() => { if (window.confirm("¿Volver a la lista estándar? Se pierde la lista propia de esta empresa.")) guardarMotivos(true); }}>Volver a la estándar</button>}
              </p>
              <p style={gris}>Cambiar la lista no toca los reclamos ya hechos: cada uno guarda el motivo con el nombre que tenía.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
