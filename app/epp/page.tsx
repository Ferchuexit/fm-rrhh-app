"use client";
// FM RRHH — app/epp/page.tsx
// EPP y ropa de trabajo. Dos vistas:
//   - Personas: qué le corresponde a cada uno y cómo está (al día, por
//     vencer, vencido, nunca entregado, falta la firma). Desde ahí se
//     registra una entrega y se imprime la constancia.
//   - Catálogo: qué elementos entrega la empresa, cada cuánto se reponen y
//     a quién le corresponden.
import { useEffect, useState } from "react";
import { ESTADOS_EPP, MOTIVOS_ENTREGA, type EstadoEpp } from "@/lib/epp-reglas";

type Elemento = { id: string; nombre: string; tipoModelo: string | null; marca: string | null; certificado: boolean; vidaUtilDias: number | null; talle: string | null; paraTodos: boolean; centroCostoIds: string[]; puestoIds: string[]; activo: boolean };
type Fila = { elementoId: string; estado: EstadoEpp; ultima: { fechaEntrega: string; vence: string | null; firmada: boolean } | null };
type Persona = { id: string; legajo: number; nombre: string; sector: string; puesto: string | null; talleRopa: string | null; talleCalzado: string | null; filas: Fila[] };
type Resumen = { personas: number; sinAsignar: number; protegidas: number; pctProtegidas: number | null; elementos: number; falta: number; vencido: number; porVencer: number; sinFirmar: number; vigente: number; pctEntregado: number | null };
type Datos = { hoy: string; sectores: { id: string; nombre: string }[]; puestos: { id: string; nombre: string }[]; sugeridos: number; elementos: Elemento[]; personas: Persona[]; resumen: Resumen; porElemento: { id: string; nombre: string; corresponde: number; falta: number; vencido: number; porVencer: number }[] };
type Entrega = { id: string; producto: string; tipoModelo: string | null; marca: string | null; cantidad: number; talle: string | null; fechaEntrega: string; vence: string | null; motivo: string; observacion: string | null; entregadoPor: string | null; firmadoEn: string | null; enPapel: boolean };
type Item = { elementoId: string; marcado: boolean; cantidad: string; talle: string; motivo: string };
type FormEl = { id: string; nombre: string; tipoModelo: string; marca: string; certificado: boolean; vidaUtilDias: string; talle: string; paraTodos: boolean; centroCostoIds: string[]; puestoIds: string[]; activo: boolean };

const VACIO: FormEl = { id: "", nombre: "", tipoModelo: "", marca: "", certificado: true, vidaUtilDias: "", talle: "", paraTodos: false, centroCostoIds: [], puestoIds: [], activo: true };
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1100px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.55rem", fontSize: "0.82rem" };
// El estado va siempre con ícono y palabra, no solo con color.
const VISTA: Record<EstadoEpp, { color: string; icono: string }> = { falta: { color: "#d03b3b", icono: "◆" }, vencido: { color: "#d03b3b", icono: "◆" }, por_vencer: { color: "#fab219", icono: "▲" }, sin_firmar: { color: "#fab219", icono: "▲" }, vigente: { color: "#0ca30c", icono: "●" } };
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" }) : "");
const peor = (filas: Fila[]): EstadoEpp | null => (["falta", "vencido", "por_vencer", "sin_firmar", "vigente"] as EstadoEpp[]).find((e) => filas.some((f) => f.estado === e)) ?? null;

async function pedir(cuerpo: unknown) {
  const res = await fetch("/api/epp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function EppPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [vista, setVista] = useState<"personas" | "catalogo">("personas");
  const [filtro, setFiltro] = useState<"todos" | "problemas" | "sin_firmar">("todos");
  const [sector, setSector] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [fecha, setFecha] = useState("");
  const [historial, setHistorial] = useState<Entrega[] | null>(null);
  const [errorEntrega, setErrorEntrega] = useState("");
  const [form, setForm] = useState<FormEl | null>(null);
  const [errorForm, setErrorForm] = useState("");

  async function cargar() {
    const res = await fetch("/api/epp");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return null; }
    setError("");
    setDatos(d);
    if (d.elementos.length === 0) setVista("catalogo");
    return d as Datos;
  }
  useEffect(() => { cargar(); }, []);

  const nombreDe = (id: string) => datos?.elementos.find((e) => e.id === id)?.nombre ?? "?";
  async function cargarHistorial(id: string) {
    const res = await fetch(`/api/epp/${id}`);
    const d = await res.json().catch(() => ({}));
    setHistorial(res.ok ? d.entregas : []);
  }
  function abrir(p: Persona) {
    setErrorEntrega(""); setHistorial(null);
    if (abierta === p.id) { setAbierta(null); return; }
    setAbierta(p.id);
    setFecha(datos!.hoy.slice(0, 10));
    // Viene tildado lo que hace falta entregar; el resto se puede sumar.
    setItems(datos!.elementos.filter((e) => e.activo).map((e) => {
      const f = p.filas.find((x) => x.elementoId === e.id);
      const hace = !!f && ["falta", "vencido", "por_vencer"].includes(f.estado);
      return { elementoId: e.id, marcado: hace, cantidad: "1", talle: (e.talle === "ropa" ? p.talleRopa : e.talle === "calzado" ? p.talleCalzado : "") ?? "", motivo: f?.estado === "falta" ? "ingreso" : "reposicion" };
    }));
    cargarHistorial(p.id);
  }
  async function entregar(p: Persona) {
    setErrorEntrega(""); setMsg("");
    const r = await pedir({ accion: "entregar", legajoId: p.id, fecha, items: items.filter((i) => i.marcado).map((i) => ({ elementoId: i.elementoId, cantidad: Number(i.cantidad), talle: i.talle, motivo: i.motivo })) });
    if (!r.ok) { setErrorEntrega(r.d.error ?? "No se pudo guardar."); return; }
    setMsg(`Entrega registrada a ${p.nombre} (${r.d.cantidad} ${r.d.cantidad === 1 ? "elemento" : "elementos"}). Le llegó el aviso para confirmarla desde el portal; si no usa el portal, imprimí la constancia y que la firme.`);
    await cargar();
    cargarHistorial(p.id);
    setItems((l) => l.map((i) => ({ ...i, marcado: false })));
  }
  async function sobreEntrega(p: Persona, cuerpo: Record<string, unknown>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    const r = await pedir(cuerpo);
    if (!r.ok) setErrorEntrega(r.d.error ?? "No se pudo guardar.");
    await cargar();
    cargarHistorial(p.id);
  }
  async function guardarElemento() {
    if (!form) return;
    setErrorForm("");
    const r = await pedir({ accion: "elemento", ...form });
    if (!r.ok) { setErrorForm(r.d.error ?? "No se pudo guardar."); return; }
    setForm(null);
    cargar();
  }
  async function sugeridos() {
    const r = await pedir({ accion: "sugeridos" });
    if (!r.ok) setError(r.d.error ?? "No se pudo guardar."); else setMsg(`Se agregaron ${r.d.agregados} elementos al catálogo. Ahora definí a quién le corresponde cada uno (Editar).`);
    cargar();
  }

  const r = datos?.resumen;
  const personas = (datos?.personas ?? []).filter((p) => (!sector || p.sector === sector) && (filtro === "todos" ? true : filtro === "problemas" ? p.filas.some((f) => f.estado === "falta" || f.estado === "vencido" || f.estado === "por_vencer") : p.filas.some((f) => f.estado === "sin_firmar")));
  const sectoresUsados = [...new Set(datos?.personas.map((p) => p.sector) ?? [])].sort();
  const aQuien = (e: Elemento) => (e.paraTodos ? "Todos" : [...e.centroCostoIds.map((id) => datos?.sectores.find((s) => s.id === id)?.nombre ?? "?"), ...e.puestoIds.map((id) => datos?.puestos.find((s) => s.id === id)?.nombre ?? "?")].join(", ") || "Nadie todavía");
  const numero = (n: string | number, rotulo: string, color = "#163A5C") => <div style={{ textAlign: "center", minWidth: 105 }}><div style={{ fontSize: "1.55rem", fontWeight: 700, color }}>{n}</div><div style={{ fontSize: "0.8rem", color: "#4A4F58" }}>{rotulo}</div></div>;
  const chip = (e: EstadoEpp, texto?: string) => <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.8rem", whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ color: VISTA[e].color }}>{VISTA[e].icono}</span>{texto ?? ESTADOS_EPP[e]}</span>;
  const tildes = (lista: { id: string; nombre: string }[], elegidos: string[], cambiar: (v: string[]) => void) => lista.map((s) => <label key={s.id} style={{ marginRight: 12, whiteSpace: "nowrap" }}><input type="checkbox" checked={elegidos.includes(s.id)} onChange={(e) => cambiar(e.target.checked ? [...elegidos, s.id] : elegidos.filter((x) => x !== s.id))} style={{ marginRight: 4 }} />{s.nombre}</label>);

  return (
    <main>
      <h1>EPP y ropa de trabajo</h1>
      <p style={{ maxWidth: "900px" }}>
        Qué elementos de protección y ropa le corresponden a cada persona, qué se le entregó y cuándo hay que reponerlo. Cada entrega la confirma el empleado desde el portal (queda día, hora y desde dónde),
        y de cada persona se imprime la constancia con el formato de la Resolución SRT 299/11.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {msg && <p style={{ color: "#2F6F5E", maxWidth: 900 }}>{msg}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && r && (
        <>
          <p>
            <button onClick={() => setVista("personas")} style={vista === "personas" ? {} : btnSec}>Personas</button>{" "}
            <button onClick={() => setVista("catalogo")} style={vista === "catalogo" ? {} : btnSec}>Catálogo ({datos.elementos.filter((e) => e.activo).length})</button>
          </p>

          {vista === "personas" && (
            <>
              {datos.elementos.length === 0 ? <p style={caja}>Primero armá el catálogo: qué elementos entrega la empresa y a quién le corresponde cada uno. <button onClick={() => setVista("catalogo")} style={chico}>Ir al catálogo</button></p> : (
                <>
                  <div style={{ ...caja, display: "flex", gap: "1.1rem", flexWrap: "wrap", alignItems: "center" }}>
                    {numero(r.pctProtegidas === null ? "—" : `${r.pctProtegidas.toLocaleString("es-AR")} %`, `protegidos (${r.protegidas} de ${r.personas})`, r.pctProtegidas !== null && r.pctProtegidas < 100 ? "#B23A3A" : "#2F6F5E")}
                    {numero(r.falta, "nunca entregados", r.falta ? "#B23A3A" : "#163A5C")}
                    {numero(r.vencido, "vencidos", r.vencido ? "#B23A3A" : "#163A5C")}
                    {numero(r.porVencer, "vencen en 30 días", r.porVencer ? "#8a5413" : "#163A5C")}
                    {numero(r.sinFirmar, "sin firmar", r.sinFirmar ? "#8a5413" : "#163A5C")}
                    {r.sinAsignar > 0 && <span style={{ fontSize: "0.85rem", color: "#6b727b", maxWidth: 260 }}>{r.sinAsignar} {r.sinAsignar === 1 ? "persona no tiene" : "personas no tienen"} ningún elemento asignado por su sector o puesto.</span>}
                  </div>
                  {datos.porElemento.some((e) => e.falta + e.vencido + e.porVencer > 0) && (
                    <div style={caja}>
                      <strong style={{ color: "#163A5C" }}>Qué hay que comprar o entregar</strong>
                      <table style={{ marginTop: "0.4rem" }}><thead><tr><th>Elemento</th><th>Le corresponde a</th><th>Nunca entregado</th><th>Vencido</th><th>Vence en 30 días</th></tr></thead>
                        <tbody>{datos.porElemento.filter((e) => e.falta + e.vencido + e.porVencer > 0).map((e) => <tr key={e.id}><td>{e.nombre}</td><td>{e.corresponde}</td><td>{e.falta || ""}</td><td>{e.vencido || ""}</td><td>{e.porVencer || ""}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                  <p>
                    {([["todos", "Todos"], ["problemas", "Con faltantes o vencimientos"], ["sin_firmar", "Falta la firma"]] as const).map(([k, n]) => <button key={k} onClick={() => setFiltro(k)} style={{ ...(filtro === k ? {} : btnSec), ...chico, marginRight: 4 }}>{n}</button>)}
                    <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector" style={{ marginLeft: 8 }}><option value="">Todos los sectores</option>{sectoresUsados.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                  </p>
                  {personas.length === 0 && <p style={{ color: "#6b727b" }}>Nadie en esta lista.</p>}
                  {personas.map((p) => {
                    const e = peor(p.filas);
                    return (
                      <div key={p.id} style={{ ...caja, padding: "0.7rem 1rem", borderLeft: `4px solid ${e ? VISTA[e].color : "#c3d0da"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                          <div><strong>{p.nombre}</strong> <span style={{ color: "#6b727b", fontSize: "0.85rem" }}>· {p.sector}{p.puesto && ` · ${p.puesto}`}{(p.talleRopa || p.talleCalzado) && ` · talles: ${[p.talleRopa && `ropa ${p.talleRopa}`, p.talleCalzado && `calzado ${p.talleCalzado}`].filter(Boolean).join(", ")}`}</span></div>
                          <span style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => abrir(p)} style={chico}>{abierta === p.id ? "Cerrar" : "Entregar / ver"}</button>
                            <a href={`/api/epp/${p.id}/planilla`} target="_blank" rel="noopener" style={{ ...chico, alignSelf: "center" }}>Constancia (PDF)</a>
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem 1.1rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                          {p.filas.length === 0 ? <span style={{ fontSize: "0.85rem", color: "#6b727b" }}>No tiene elementos asignados por su sector o puesto.</span> : p.filas.map((f) => <span key={f.elementoId} title={f.ultima ? `Entregado el ${dia(f.ultima.fechaEntrega)}${f.ultima.vence ? ` · vence el ${dia(f.ultima.vence)}` : ""}` : "Nunca se entregó"}>{chip(f.estado, `${nombreDe(f.elementoId)}${f.estado === "vigente" ? "" : `: ${ESTADOS_EPP[f.estado].toLowerCase()}${(f.estado === "por_vencer" || f.estado === "vencido") && f.ultima?.vence ? ` (${dia(f.ultima.vence)})` : ""}`}`)}</span>)}
                        </div>
                        {abierta === p.id && (
                          <div style={{ marginTop: "0.8rem", borderTop: "1px solid #dfe4e8", paddingTop: "0.7rem" }}>
                            <strong style={{ color: "#163A5C" }}>Registrar una entrega</strong>
                            <table style={{ marginTop: "0.4rem" }}>
                              <thead><tr><th></th><th>Elemento</th><th>Cantidad</th><th>Talle</th><th>Motivo</th></tr></thead>
                              <tbody>
                                {items.map((it, i) => {
                                  const el = datos.elementos.find((x) => x.id === it.elementoId)!;
                                  const cambiar = (c: Partial<Item>) => setItems(items.map((x, k) => (k === i ? { ...x, ...c } : x)));
                                  return (
                                    <tr key={it.elementoId} style={{ opacity: it.marcado ? 1 : 0.6 }}>
                                      <td><input type="checkbox" checked={it.marcado} onChange={(e) => cambiar({ marcado: e.target.checked })} aria-label={`Entregar ${el.nombre}`} /></td>
                                      <td>{el.nombre}{el.tipoModelo && <span style={{ color: "#6b727b", fontSize: "0.82rem" }}> · {el.tipoModelo}</span>}{!p.filas.some((f) => f.elementoId === el.id) && <span style={{ color: "#8a5413", fontSize: "0.78rem" }}> (no le corresponde por puesto)</span>}</td>
                                      <td><input type="number" min={1} max={100} value={it.cantidad} onChange={(e) => cambiar({ cantidad: e.target.value })} style={{ width: 60 }} disabled={!it.marcado} /></td>
                                      <td>{el.talle ? <input value={it.talle} maxLength={10} onChange={(e) => cambiar({ talle: e.target.value })} style={{ width: 70 }} disabled={!it.marcado} placeholder={el.talle === "ropa" ? "M, L…" : "42"} /> : ""}</td>
                                      <td><select value={it.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} disabled={!it.marcado}>{Object.entries(MOTIVOS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.6rem" }}>
                              <label>Fecha de entrega <input type="date" value={fecha} max={datos.hoy.slice(0, 10)} onChange={(e) => setFecha(e.target.value)} /></label>
                              <button onClick={() => entregar(p)} disabled={!items.some((i) => i.marcado)}>Registrar entrega</button>
                            </div>
                            {errorEntrega && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorEntrega}</p>}

                            <strong style={{ color: "#163A5C", display: "block", marginTop: "1rem" }}>Historial</strong>
                            {!historial ? <p>Cargando…</p> : historial.length === 0 ? <p style={{ color: "#6b727b", margin: "0.3rem 0 0" }}>Todavía no se le entregó nada.</p> : (
                              <table style={{ marginTop: "0.4rem", fontSize: "0.88rem" }}>
                                <thead><tr><th>Entrega</th><th>Elemento</th><th>Cant.</th><th>Motivo</th><th>Vence</th><th>Firma</th><th></th></tr></thead>
                                <tbody>
                                  {historial.map((h) => (
                                    <tr key={h.id}>
                                      <td>{dia(h.fechaEntrega)}</td>
                                      <td>{h.producto}{h.talle && ` (${h.talle})`}{h.marca && <span style={{ color: "#6b727b" }}> · {h.marca}</span>}</td>
                                      <td>{h.cantidad}</td><td>{h.motivo}</td><td>{dia(h.vence) || "—"}</td>
                                      <td>{h.firmadoEn ? <span style={{ color: "#2F6F5E" }}>Portal, {new Date(h.firmadoEn).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" })}</span> : <label><input type="checkbox" checked={h.enPapel} onChange={(e) => sobreEntrega(p, { accion: "enPapel", id: h.id, valor: e.target.checked })} style={{ marginRight: 4 }} />Firmó en papel</label>}</td>
                                      <td>{!h.firmadoEn && <button onClick={() => sobreEntrega(p, { accion: "anular", id: h.id }, "Se borra esta entrega (para corregir un error de carga). ¿Seguimos?")} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Anular</button>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {vista === "catalogo" && (
            <>
              {!form && <p><button onClick={() => { setErrorForm(""); setForm({ ...VACIO }); }}>Nuevo elemento</button>{datos.sugeridos > 0 && <> <button onClick={sugeridos} style={btnSec}>Agregar los {datos.sugeridos} elementos típicos</button> <span style={{ color: "#6b727b", fontSize: "0.85rem" }}>calzado, ropa, protección ocular y auditiva, guantes, casco… para no arrancar de cero</span></>}</p>}
              {form && (
                <div style={{ ...caja, borderLeft: "4px solid #163A5C" }}>
                  <strong style={{ color: "#163A5C" }}>{form.id ? "Editar elemento" : "Nuevo elemento"}</strong>
                  <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                    <label style={{ flex: "1 1 220px" }}>Producto<br /><input value={form.nombre} maxLength={80} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Calzado de seguridad" style={{ width: "100%" }} /></label>
                    <label style={{ flex: "1 1 220px" }}>Tipo / modelo<br /><input value={form.tipoModelo} maxLength={80} onChange={(e) => setForm({ ...form, tipoModelo: e.target.value })} placeholder="Botín con puntera de acero" style={{ width: "100%" }} /></label>
                    <label style={{ flex: "1 1 160px" }}>Marca<br /><input value={form.marca} maxLength={60} onChange={(e) => setForm({ ...form, marca: e.target.value })} style={{ width: "100%" }} /></label>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.6rem", alignItems: "flex-end" }}>
                    <label>Se repone cada <input type="number" min={1} max={3650} value={form.vidaUtilDias} onChange={(e) => setForm({ ...form, vidaUtilDias: e.target.value })} style={{ width: 80 }} /> días <span style={{ color: "#6b727b" }}>(vacío = no vence)</span></label>
                    <label>Lleva talle de <select value={form.talle} onChange={(e) => setForm({ ...form, talle: e.target.value })}><option value="">— no lleva —</option><option value="ropa">ropa</option><option value="calzado">calzado</option></select></label>
                    <label><input type="checkbox" checked={form.certificado} onChange={(e) => setForm({ ...form, certificado: e.target.checked })} style={{ marginRight: 4 }} />Posee certificación</label>
                    {form.id && <label><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} style={{ marginRight: 4 }} />En uso</label>}
                  </div>
                  <div style={{ marginTop: "0.7rem" }}>
                    <strong>A quién le corresponde:</strong>{" "}
                    <label><input type="checkbox" checked={form.paraTodos} onChange={(e) => setForm({ ...form, paraTodos: e.target.checked })} style={{ marginRight: 4 }} />A todos</label>
                    {!form.paraTodos && (
                      <div style={{ marginTop: "0.4rem", fontSize: "0.92rem" }}>
                        <div><span style={{ color: "#6b727b" }}>Por sector: </span>{datos.sectores.length ? tildes(datos.sectores, form.centroCostoIds, (v) => setForm({ ...form, centroCostoIds: v })) : <em style={{ color: "#6b727b" }}>no hay sectores cargados</em>}</div>
                        <div style={{ marginTop: 4 }}><span style={{ color: "#6b727b" }}>Por puesto: </span>{datos.puestos.length ? tildes(datos.puestos, form.puestoIds, (v) => setForm({ ...form, puestoIds: v })) : <em style={{ color: "#6b727b" }}>no hay puestos cargados (Desarrollo de talento → Puestos)</em>}</div>
                        <p style={{ fontSize: "0.8rem", color: "#6b727b", margin: "0.3rem 0 0" }}>Le corresponde a quien esté en alguno de esos sectores o puestos. Si no marcás nada, no se le exige a nadie y se entrega solo cuando hace falta.</p>
                      </div>
                    )}
                  </div>
                  {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}><button onClick={guardarElemento}>Guardar</button><button onClick={() => setForm(null)} style={btnSec}>Cancelar</button></div>
                </div>
              )}
              {datos.elementos.length === 0 && !form && <p style={{ color: "#6b727b" }}>El catálogo está vacío.</p>}
              {datos.elementos.length > 0 && (
                <div style={caja}>
                  <table>
                    <thead><tr><th>Producto</th><th>Tipo / modelo</th><th>Marca</th><th>Certif.</th><th>Se repone</th><th>A quién le corresponde</th><th></th></tr></thead>
                    <tbody>
                      {datos.elementos.map((e) => (
                        <tr key={e.id} style={{ opacity: e.activo ? 1 : 0.5 }}>
                          <td><strong>{e.nombre}</strong>{!e.activo && " (fuera de uso)"}</td><td>{e.tipoModelo ?? ""}</td><td>{e.marca ?? ""}</td><td>{e.certificado ? "Sí" : "No"}</td>
                          <td>{e.vidaUtilDias ? `cada ${e.vidaUtilDias} días` : "no vence"}</td>
                          <td style={aQuien(e) === "Nadie todavía" ? { color: "#8a5413" } : undefined}>{aQuien(e)}</td>
                          <td><button onClick={() => { setErrorForm(""); setForm({ id: e.id, nombre: e.nombre, tipoModelo: e.tipoModelo ?? "", marca: e.marca ?? "", certificado: e.certificado, vidaUtilDias: e.vidaUtilDias ? String(e.vidaUtilDias) : "", talle: e.talle ?? "", paraTodos: e.paraTodos, centroCostoIds: e.centroCostoIds, puestoIds: e.puestoIds, activo: e.activo }); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ ...btnSec, ...chico }}>Editar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: "0.82rem", color: "#6b727b", margin: "0.6rem 0 0" }}>La vida útil de cada elemento la define el responsable de higiene y seguridad según la tarea y el fabricante: los valores sugeridos son solo un punto de partida.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
