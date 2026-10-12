"use client";
// FM RRHH — app/banco-horas/page.tsx
// Banco de horas (art. 197 bis LCT, Ley 27.802). Tres vistas:
//   - Personas: el acuerdo y el saldo de cada uno; desde ahí se propone el
//     acuerdo, se acredita, se compensa, se paga y se ve el historial.
//   - Horas extra de la asistencia: lo que surge de las fichadas, día por
//     día, para mandarlo al banco, pagarlo o descartarlo.
//   - Pedidos: lo que piden los empleados desde el portal.
import { useEffect, useState } from "react";
import { textoHoras, ESTADOS_ACUERDO, EQUIVALENCIAS, ORIGENES_ACUERDO, TIPOS_MOVIMIENTO, type EstadoAcuerdo } from "@/lib/banco-horas-reglas";

type Acuerdo = { id: string; estado: EstadoAcuerdo; desde: string; hasta: string | null; topeHoras: number | null; plazoDias: number | null; equivalencia: string; origen: string; aceptadoEn: string | null; enPapel: boolean };
type Persona = { id: string; legajo: number; nombre: string; sector: string; acuerdo: Acuerdo | null; saldo: number; disponible: number; porVencer: number; vencido: number; pendientes: number; egreso: string | null; movimientos: number };
type Pedido = { id: string; legajoId: string; nombre: string; sector: string; tipo: string; fecha: string; minutos: number; motivo: string | null; pedidoEn: string; saldo: number };
type Periodo = { id: string; nombre: string; convenioId: string | null };
type Datos = { hoy: string; periodos: Periodo[]; personas: Persona[]; pedidos: Pedido[]; resumen: { personas: number; vigentes: number; sinFirmar: number; saldo: number; porVencer: number; vencido: number; pendientes: number; egresoConSaldo: number; conAcuerdo: number } };
type Mov = { id: string; tipo: string; fecha: string; minutos: number; minutosTrabajados: number | null; recargo: number | null; estado: string; origen: string; motivo: string | null; anulado: boolean; motivoAnulacion: string | null; cargadoPor: string | null; novedadId: string | null };
type Lote = { id: string; fecha: string; recargo: number | null; restante: number; vence: string | null; estado: string };
type Detalle = { acuerdos: (Acuerdo & { aceptadoIp: string | null; finalizadoEn: string | null; observaciones: string | null; createdAt: string })[]; movimientos: Mov[]; lotes: Lote[]; saldo: number; disponible: number };
type Fila = { legajoId: string; legajo: number; nombre: string; sector: string; fecha: string; ingreso: string | null; egreso: string | null; programado: { ingreso: string; salida: string } | null; feriado: boolean; m50: number; m100: number; conAcuerdo: boolean; alertas: string[]; destino: string; marcada: boolean };

const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1150px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.55rem", fontSize: "0.82rem" };
const gris: React.CSSProperties = { color: "#6b727b", fontSize: "0.85rem" };
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" }) : "");
const diaSemana = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const hhmm = (h: string | null) => (h ? h.slice(0, 5) : "—");
// El estado va con ícono y palabra, no solo con color.
const VISTA_ACUERDO: Record<EstadoAcuerdo, { color: string; icono: string }> = { vigente: { color: "#0ca30c", icono: "●" }, sin_firmar: { color: "#fab219", icono: "▲" }, futuro: { color: "#4A7FB5", icono: "◇" }, terminado: { color: "#9aa5b1", icono: "○" } };
const ACUERDO_VACIO = { desde: "", hasta: "", origen: "individual", topeHoras: "", plazoDias: "180", equivalencia: "recargo", observaciones: "" };
const MOV_VACIO = { tipo: "acreditacion", fecha: "", horas: "", recargo: "50", signo: "+", motivo: "" };

async function pedir(cuerpo: unknown) {
  const res = await fetch("/api/banco-horas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}
const primeroDeMes = (hoy: string) => hoy.slice(0, 8) + "01";

export default function BancoHorasPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [vista, setVista] = useState<"personas" | "detectar" | "pedidos">("personas");
  const [filtro, setFiltro] = useState<"todos" | "con" | "sin" | "atencion">("todos");
  const [buscar, setBuscar] = useState("");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [formAcuerdo, setFormAcuerdo] = useState<typeof ACUERDO_VACIO | null>(null);
  const [errorAcuerdo, setErrorAcuerdo] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [mov, setMov] = useState(MOV_VACIO);
  const [pago, setPago] = useState({ horas: "", periodoId: "" });
  const [errorDetalle, setErrorDetalle] = useState("");
  const [rango, setRango] = useState({ desde: "", hasta: "" });
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [infoDetectar, setInfoDetectar] = useState("");
  const [periodoPago, setPeriodoPago] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [periodoPedido, setPeriodoPedido] = useState<Record<string, string>>({});

  async function cargar() {
    const res = await fetch("/api/banco-horas");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
    setRango((r) => (r.desde ? r : { desde: primeroDeMes(d.hoy.slice(0, 10)), hasta: d.hoy.slice(0, 10) }));
  }
  useEffect(() => { cargar(); }, []);

  async function cargarDetalle(id: string) {
    const res = await fetch(`/api/banco-horas/${id}`);
    const d = await res.json().catch(() => ({}));
    setDetalle(res.ok ? d : null);
  }
  function abrir(p: Persona) {
    setErrorDetalle(""); setDetalle(null);
    if (abierta === p.id) { setAbierta(null); return; }
    setAbierta(p.id);
    setMov({ ...MOV_VACIO, fecha: datos!.hoy.slice(0, 10) });
    setPago({ horas: "", periodoId: datos!.periodos[0]?.id ?? "" });
    cargarDetalle(p.id);
  }
  async function accion(cuerpo: Record<string, unknown>, exito: string, p?: Persona) {
    setErrorDetalle(""); setMsg("");
    const r = await pedir(cuerpo);
    if (!r.ok) { if (p) setErrorDetalle(r.d.error ?? "No se pudo guardar."); else setError(r.d.error ?? "No se pudo guardar."); return false; }
    setMsg(exito);
    await cargar();
    if (p) cargarDetalle(p.id);
    return r.d;
  }
  async function crearAcuerdos() {
    if (!formAcuerdo) return;
    setErrorAcuerdo("");
    const r = await pedir({ accion: "acuerdo", legajoIds: elegidos, ...formAcuerdo });
    if (!r.ok) { setErrorAcuerdo(r.d.error ?? "No se pudo guardar."); return; }
    setFormAcuerdo(null); setElegidos([]);
    setMsg(`Se propuso el acuerdo a ${r.d.creados} ${r.d.creados === 1 ? "persona" : "personas"}${r.d.saltados ? ` (${r.d.saltados} ya ${r.d.saltados === 1 ? "tenía" : "tenían"} uno abierto y no se ${r.d.saltados === 1 ? "tocó" : "tocaron"})` : ""}. Les llegó el aviso para leerlo y aceptarlo en el portal. Quien no usa el portal: imprimí el acuerdo, que lo firme, y marcalo como "firmado en papel".`);
    cargar();
  }
  async function detectar() {
    setBuscando(true); setInfoDetectar(""); setFilas(null);
    const res = await fetch(`/api/banco-horas/detectar?desde=${rango.desde}&hasta=${rango.hasta}`);
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    setBuscando(false);
    if (!res.ok) { setInfoDetectar(d.error ?? "No se pudo revisar."); return; }
    setFilas(d.filas.map((f: Fila) => ({ ...f, destino: f.conAcuerdo ? "banco" : "pagar", marcada: true })));
    setPeriodoPago((x) => x || datos?.periodos[0]?.id || "");
    const notas = [];
    if (d.sinClasificar) notas.push("No hay asistencia clasificada en ese rango: primero tocá «Clasificar» en Asistencia.");
    if (d.sinHorario) notas.push(`${d.sinHorario} ${d.sinHorario === 1 ? "día fichado no se pudo revisar" : "días fichados no se pudieron revisar"} porque la persona no tiene horario asignado en Turnos.`);
    setInfoDetectar(notas.join(" "));
  }
  async function confirmar() {
    if (!filas) return;
    const items = filas.filter((f) => f.marcada).map((f) => ({ legajoId: f.legajoId, fecha: f.fecha, m50: f.m50, m100: f.m100, destino: f.destino }));
    const r = await pedir({ accion: "confirmar", items, periodoId: periodoPago || null });
    if (!r.ok) { setInfoDetectar(r.d.error ?? "No se pudo guardar."); return; }
    const partes = [r.d.alBanco && `${r.d.alBanco} al banco`, r.d.pagadas && `${r.d.pagadas} a pagar (ya están como novedad en el período)`, r.d.descartadas && `${r.d.descartadas} descartados`].filter(Boolean);
    setMsg(`Listo: ${partes.join(", ") || "nada para guardar"}.${r.d.errores.length ? " No se pudo con: " + r.d.errores.join(" · ") : ""}`);
    await cargar();
    detectar();
  }

  const r = datos?.resumen;
  const atencion = (p: Persona) => p.vencido > 0 || p.porVencer > 0 || p.pendientes > 0 || (!!p.egreso && p.saldo > 0) || p.acuerdo?.estado === "sin_firmar";
  const personas = (datos?.personas ?? []).filter((p) => {
    if (buscar && !`${p.nombre} ${p.legajo} ${p.sector}`.toLowerCase().includes(buscar.toLowerCase())) return false;
    const abierto = p.acuerdo && p.acuerdo.estado !== "terminado";
    return filtro === "todos" || (filtro === "con" ? abierto : filtro === "sin" ? !abierto : atencion(p));
  });
  const numero = (n: string | number, rotulo: string, color = "#163A5C") => <div style={{ textAlign: "center", minWidth: 110 }}><div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{n}</div><div style={{ fontSize: "0.8rem", color: "#4A4F58" }}>{rotulo}</div></div>;
  const chipAcuerdo = (a: Acuerdo | null) => a ? <span style={{ display: "inline-flex", gap: 4, fontSize: "0.82rem", whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ color: VISTA_ACUERDO[a.estado].color }}>{VISTA_ACUERDO[a.estado].icono}</span>{ESTADOS_ACUERDO[a.estado]}</span> : <span style={gris}>Sin acuerdo</span>;
  const sinAcuerdoAbierto = (id: string) => { const p = datos?.personas.find((x) => x.id === id); return !p?.acuerdo || p.acuerdo.estado === "terminado"; };

  return (
    <main>
      <h1>Banco de horas</h1>
      <p style={{ maxWidth: 950 }}>
        Las horas extra se pueden compensar con descanso en vez de pagarse, si la persona lo acepta por escrito (art. 197 bis de la LCT, texto de la Ley 27.802). El sistema lleva la cuenta de cada uno con las fichadas, el empleado ve su saldo en el portal y pide sus francos desde ahí.
        Lo que no se compensa a tiempo, o queda al egreso, se paga con su recargo.
      </p>
      <p style={{ ...gris, maxWidth: 950, borderLeft: "3px solid #fab219", paddingLeft: 8 }}>
        El texto del acuerdo es un modelo: antes de usarlo, revisalo con el asesor legal y contra el convenio colectivo de la actividad, que puede fijar reglas propias de jornada y horas extra.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {msg && <p style={{ color: "#2F6F5E", maxWidth: 950 }}>{msg}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && r && (
        <>
          <div style={{ ...caja, display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            {numero(r.vigentes, "con acuerdo vigente")}
            {numero(r.sinFirmar, "falta que firmen", r.sinFirmar ? "#8a5413" : "#163A5C")}
            {numero(textoHoras(r.saldo), "en el banco")}
            {numero(textoHoras(r.porVencer), "vencen en 30 días", r.porVencer ? "#8a5413" : "#163A5C")}
            {numero(textoHoras(r.vencido), "vencidas: a pagar", r.vencido ? "#B23A3A" : "#163A5C")}
            {numero(r.pendientes, "pedidos sin responder", r.pendientes ? "#B23A3A" : "#163A5C")}
            {r.egresoConSaldo > 0 && numero(r.egresoConSaldo, "se van con saldo: pagar en la final", "#B23A3A")}
          </div>
          <p>
            <button onClick={() => setVista("personas")} style={vista === "personas" ? {} : btnSec}>Personas</button>{" "}
            <button onClick={() => setVista("detectar")} style={vista === "detectar" ? {} : btnSec}>Horas extra de la asistencia</button>{" "}
            <button onClick={() => setVista("pedidos")} style={vista === "pedidos" ? {} : btnSec}>Pedidos del portal{r.pendientes ? ` (${r.pendientes})` : ""}</button>
          </p>

          {vista === "personas" && (
            <>
              <p style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {([["todos", "Todos"], ["con", "Con acuerdo"], ["sin", "Sin acuerdo"], ["atencion", "Para atender"]] as const).map(([k, n]) => <button key={k} onClick={() => setFiltro(k)} style={{ ...(filtro === k ? {} : btnSec), ...chico }}>{n}</button>)}
                <input placeholder="Buscar persona, legajo o sector" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ minWidth: 240 }} aria-label="Buscar" />
                <span style={{ flex: 1 }} />
                <button disabled={elegidos.length === 0} onClick={() => { setErrorAcuerdo(""); setFormAcuerdo({ ...ACUERDO_VACIO, desde: datos.hoy.slice(0, 10) }); }}>Proponer acuerdo{elegidos.length ? ` a ${elegidos.length}` : ""}</button>
              </p>
              {formAcuerdo && (
                <div style={{ ...caja, borderLeft: "4px solid #163A5C" }}>
                  <strong style={{ color: "#163A5C" }}>Acuerdo de banco de horas para {elegidos.length} {elegidos.length === 1 ? "persona" : "personas"}</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem 1rem", marginTop: "0.6rem" }}>
                    <label>Desde<br /><input type="date" value={formAcuerdo.desde} onChange={(e) => setFormAcuerdo({ ...formAcuerdo, desde: e.target.value })} /></label>
                    <label>Hasta (opcional)<br /><input type="date" value={formAcuerdo.hasta} onChange={(e) => setFormAcuerdo({ ...formAcuerdo, hasta: e.target.value })} /></label>
                    <label>Cómo se pactó<br /><select value={formAcuerdo.origen} onChange={(e) => setFormAcuerdo({ ...formAcuerdo, origen: e.target.value })}>{Object.entries(ORIGENES_ACUERDO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    <label>Tope de horas acumuladas (opcional)<br /><input type="number" min={1} max={400} value={formAcuerdo.topeHoras} onChange={(e) => setFormAcuerdo({ ...formAcuerdo, topeHoras: e.target.value })} placeholder="Sin tope propio" /></label>
                    <label>Días para compensar cada hora<br /><input type="number" min={7} max={730} value={formAcuerdo.plazoDias} onChange={(e) => setFormAcuerdo({ ...formAcuerdo, plazoDias: e.target.value })} placeholder="Sin plazo" /></label>
                    <label>Cuánto descanso da cada hora<br /><select value={formAcuerdo.equivalencia} onChange={(e) => setFormAcuerdo({ ...formAcuerdo, equivalencia: e.target.value })}>{Object.entries(EQUIVALENCIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  </div>
                  <label style={{ display: "block", marginTop: "0.6rem" }}>Condiciones particulares (opcional, van en el acuerdo)<br /><textarea value={formAcuerdo.observaciones} onChange={(e) => setFormAcuerdo({ ...formAcuerdo, observaciones: e.target.value })} rows={2} maxLength={1000} style={{ width: "100%", maxWidth: 800 }} placeholder="Ej.: los francos se piden con 48 h de anticipación." /></label>
                  {formAcuerdo.equivalencia === "simple" && <p style={{ ...gris, color: "#8a5413" }}>Hora por hora: la persona compensa sin el recargo del 50 % o 100 %. La ley no lo prohíbe, pero es el punto más discutido del régimen; la opción con recargo es la más segura.</p>}
                  {errorAcuerdo && <p style={{ color: "#B23A3A" }}>{errorAcuerdo}</p>}
                  <p style={{ display: "flex", gap: 6 }}><button onClick={crearAcuerdos}>Proponer y avisar por el portal</button><button style={btnSec} onClick={() => setFormAcuerdo(null)}>Cancelar</button></p>
                </div>
              )}
              <div style={{ ...caja, padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%" }}>
                  <thead><tr>
                    <th><input type="checkbox" aria-label="Elegir todos los que no tienen acuerdo" checked={personas.length > 0 && personas.filter((p) => sinAcuerdoAbierto(p.id)).every((p) => elegidos.includes(p.id)) && elegidos.length > 0} onChange={(e) => setElegidos(e.target.checked ? personas.filter((p) => sinAcuerdoAbierto(p.id)).map((p) => p.id) : [])} /></th>
                    <th>Persona</th><th>Acuerdo</th><th style={{ textAlign: "right" }}>En el banco</th><th style={{ textAlign: "right" }}>Por vencer</th><th style={{ textAlign: "right" }}>Vencidas</th><th>Para atender</th><th></th>
                  </tr></thead>
                  <tbody>
                    {personas.length === 0 && <tr><td colSpan={8} style={gris}>Nadie en esta lista.</td></tr>}
                    {personas.map((p) => (
                      <PersonaFila key={p.id} p={p} elegible={sinAcuerdoAbierto(p.id)} elegido={elegidos.includes(p.id)} onElegir={(v) => setElegidos(v ? [...elegidos, p.id] : elegidos.filter((x) => x !== p.id))} abierta={abierta === p.id} onAbrir={() => abrir(p)} chip={chipAcuerdo(p.acuerdo)}>
                        {abierta === p.id && (
                          <div style={{ padding: "0.8rem 1rem", background: "#f7f9fb", borderTop: "1px solid #dfe4e8" }}>
                            {!detalle ? <p>Cargando…</p> : (
                              <>
                                {errorDetalle && <p style={{ color: "#B23A3A" }}>{errorDetalle}</p>}
                                <strong style={{ color: "#163A5C" }}>Acuerdos</strong>
                                {detalle.acuerdos.length === 0 && <p style={gris}>No tiene. Tildalo en la lista y tocá «Proponer acuerdo».</p>}
                                {detalle.acuerdos.map((a) => (
                                  <div key={a.id} style={{ display: "flex", gap: "0.5rem 1rem", flexWrap: "wrap", alignItems: "center", margin: "0.35rem 0" }}>
                                    {chipAcuerdo(a)}
                                    <span style={{ fontSize: "0.88rem" }}>Desde {dia(a.desde)}{a.hasta && ` hasta ${dia(a.hasta)}`}{a.finalizadoEn && ` · sin efecto desde ${dia(a.finalizadoEn)}`} · {a.equivalencia === "simple" ? "hora por hora" : "con recargo"}{a.topeHoras && ` · tope ${a.topeHoras} h`}{a.plazoDias && ` · ${a.plazoDias} días para compensar`}</span>
                                    <span style={gris}>{a.aceptadoEn ? `Aceptado en el portal el ${new Date(a.aceptadoEn).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : a.enPapel ? "Firmado en papel" : "Esperando que lo acepte"}</span>
                                    <a href={`/api/banco-horas/acuerdo/${a.id}`} target="_blank" rel="noopener" style={chico}>Acuerdo (PDF)</a>
                                    {!a.aceptadoEn && a.estado !== "terminado" && <button style={{ ...btnSec, ...chico }} onClick={() => accion({ accion: "papel", id: a.id, valor: !a.enPapel }, a.enPapel ? "Se desmarcó la firma en papel." : "Marcado como firmado en papel.", p)}>{a.enPapel ? "Desmarcar firma en papel" : "Firmó en papel"}</button>}
                                    {a.estado !== "terminado" && <button style={{ ...btnSec, ...chico }} onClick={() => { const f = window.prompt("¿Desde qué día queda sin efecto? (AAAA-MM-DD). Las horas que tenga se siguen pudiendo compensar o pagar.", datos.hoy.slice(0, 10)); if (f) accion({ accion: "terminar", id: a.id, fecha: f }, "El acuerdo quedó sin efecto desde esa fecha.", p); }}>Dejar sin efecto</button>}
                                  </div>
                                ))}

                                <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", marginTop: "0.8rem" }}>
                                  <div style={{ flex: "1 1 380px" }}>
                                    <strong style={{ color: "#163A5C" }}>Cargar a mano</strong>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "end", marginTop: 4 }}>
                                      <label>Qué<br /><select value={mov.tipo} onChange={(e) => setMov({ ...mov, tipo: e.target.value })}><option value="acreditacion">Horas extra al banco</option><option value="compensacion">Descanso que se toma</option><option value="ajuste">Ajuste</option></select></label>
                                      <label>Día<br /><input type="date" value={mov.fecha} onChange={(e) => setMov({ ...mov, fecha: e.target.value })} /></label>
                                      <label>{mov.tipo === "acreditacion" ? "Horas extra trabajadas" : "Horas"}<br /><input value={mov.horas} onChange={(e) => setMov({ ...mov, horas: e.target.value })} placeholder="2 o 1:30" style={{ width: 80 }} /></label>
                                      {mov.tipo === "acreditacion" && <label>Recargo<br /><select value={mov.recargo} onChange={(e) => setMov({ ...mov, recargo: e.target.value })}><option value="50">50 %</option><option value="100">100 %</option></select></label>}
                                      {mov.tipo === "ajuste" && <label>Signo<br /><select value={mov.signo} onChange={(e) => setMov({ ...mov, signo: e.target.value })}><option value="+">Suma</option><option value="-">Resta</option></select></label>}
                                    </div>
                                    <input value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })} placeholder={mov.tipo === "ajuste" ? "Motivo (obligatorio, lo ve el empleado)" : "Comentario (opcional)"} maxLength={300} style={{ width: "100%", maxWidth: 420, marginTop: 6 }} />
                                    <p><button style={chico} onClick={async () => { if (await accion({ accion: "movimiento", legajoId: p.id, ...mov }, "Guardado.", p)) setMov({ ...MOV_VACIO, tipo: mov.tipo, fecha: mov.fecha }); }}>Guardar</button></p>
                                  </div>
                                  <div style={{ flex: "1 1 300px" }}>
                                    <strong style={{ color: "#163A5C" }}>Pagar horas del banco</strong>
                                    <p style={{ ...gris, margin: "2px 0 4px" }}>Salen de las más viejas y pasan a liquidación como horas extra al 50 % o 100 %, según cómo se generaron.</p>
                                    {datos.periodos.length === 0 ? <p style={gris}>No hay ningún período de liquidación abierto.</p> : (
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "end" }}>
                                        <label>Horas de descanso<br /><input value={pago.horas} onChange={(e) => setPago({ ...pago, horas: e.target.value })} placeholder={textoHoras(Math.max(0, detalle.disponible))} style={{ width: 90 }} /></label>
                                        <label>Período<br /><select value={pago.periodoId} onChange={(e) => setPago({ ...pago, periodoId: e.target.value })}>{datos.periodos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
                                        <button style={chico} onClick={async () => { const d = await accion({ accion: "pagar", legajoId: p.id, ...pago }, "Pago cargado.", p); if (d) { setMsg(`Pasaron a liquidación ${textoHoras(d.m50)} al 50 % y ${textoHoras(d.m100)} al 100 %.`); setPago({ ...pago, horas: "" }); } }}>Pagar</button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {detalle.lotes.length > 0 && (
                                  <>
                                    <strong style={{ color: "#163A5C", display: "block", marginTop: "0.8rem" }}>Lo que tiene, de lo más viejo a lo más nuevo</strong>
                                    <p style={{ fontSize: "0.88rem", margin: "4px 0" }}>{detalle.lotes.map((l) => <span key={l.id} style={{ marginRight: 14, whiteSpace: "nowrap", color: l.estado === "vencido" ? "#B23A3A" : l.estado === "por_vencer" ? "#8a5413" : undefined }}>{textoHoras(l.restante)} del {dia(l.fecha)}{l.recargo ? ` (${l.recargo} %)` : ""}{l.vence ? ` · ${l.estado === "vencido" ? "venció" : "vence"} ${dia(l.vence)}` : ""}</span>)}</p>
                                  </>
                                )}
                                <strong style={{ color: "#163A5C", display: "block", marginTop: "0.8rem" }}>Movimientos</strong>
                                {detalle.movimientos.length === 0 ? <p style={gris}>Todavía no tiene.</p> : (
                                  <table style={{ marginTop: 4, fontSize: "0.88rem" }}>
                                    <thead><tr><th>Día</th><th>Qué</th><th style={{ textAlign: "right" }}>Descanso</th><th>Detalle</th><th></th></tr></thead>
                                    <tbody>{detalle.movimientos.map((m) => (
                                      <tr key={m.id} style={{ opacity: m.anulado || m.estado === "rechazado" ? 0.5 : 1, textDecoration: m.anulado ? "line-through" : undefined }}>
                                        <td>{dia(m.fecha)}</td>
                                        <td>{TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo}{m.estado !== "aprobado" && ` (${m.estado})`}</td>
                                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{m.minutos ? `${m.minutos > 0 ? "+" : ""}${textoHoras(m.minutos)}` : "—"}</td>
                                        <td style={gris}>{[m.minutosTrabajados && `${textoHoras(m.minutosTrabajados)} extra${m.recargo ? ` al ${m.recargo} %` : ""}`, m.origen === "asistencia" ? "de las fichadas" : m.origen === "portal" ? "pedido en el portal" : null, m.novedadId && "en liquidación", m.motivo, m.anulado && `anulado: ${m.motivoAnulacion}`].filter(Boolean).join(" · ")}</td>
                                        <td>{!m.anulado && m.estado !== "rechazado" && m.estado !== "pendiente" && <button style={{ ...btnSec, ...chico }} onClick={() => { const motivo = window.prompt("¿Por qué se anula? Queda en el historial."); if (motivo) accion({ accion: "anular", id: m.id, motivo }, "Movimiento anulado.", p); }}>Anular</button>}</td>
                                      </tr>
                                    ))}</tbody>
                                  </table>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </PersonaFila>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {vista === "detectar" && (
            <>
              <div style={caja}>
                <p style={{ marginTop: 0 }}>Revisa la asistencia ya clasificada y propone las horas extra de cada día: lo que se quedó después de su horario y lo trabajado en francos y feriados. Se cuenta de a media hora (menos de 30 minutos no suma). Entrar antes de hora no cuenta: si estaba pedido, cargalo a mano.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                  <label>Desde<br /><input type="date" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} /></label>
                  <label>Hasta<br /><input type="date" value={rango.hasta} max={datos.hoy.slice(0, 10)} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} /></label>
                  <button onClick={detectar} disabled={buscando}>{buscando ? "Revisando…" : "Buscar horas extra"}</button>
                </div>
                {infoDetectar && <p style={{ color: "#8a5413" }}>{infoDetectar}</p>}
              </div>
              {filas && filas.length === 0 && <p style={gris}>No hay horas extra sin procesar en ese rango.</p>}
              {filas && filas.length > 0 && (
                <>
                  <div style={{ ...caja, padding: 0, overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: "0.9rem" }}>
                      <thead><tr><th><input type="checkbox" aria-label="Elegir todas" checked={filas.every((f) => f.marcada)} onChange={(e) => setFilas(filas.map((f) => ({ ...f, marcada: e.target.checked })))} /></th><th>Persona</th><th>Día</th><th>Horario</th><th>Fichó</th><th style={{ textAlign: "right" }}>Al 50 %</th><th style={{ textAlign: "right" }}>Al 100 %</th><th>Qué hacer</th></tr></thead>
                      <tbody>{filas.map((f, i) => {
                        const cambiar = (c: Partial<Fila>) => setFilas(filas.map((x, k) => (k === i ? { ...x, ...c } : x)));
                        return (
                          <tr key={`${f.legajoId}${f.fecha}`} style={{ opacity: f.marcada ? 1 : 0.55, verticalAlign: "top" }}>
                            <td><input type="checkbox" checked={f.marcada} onChange={(e) => cambiar({ marcada: e.target.checked })} aria-label={`Procesar ${f.nombre} ${dia(f.fecha)}`} /></td>
                            <td>{f.nombre}<div style={gris}>{f.sector}</div></td>
                            <td style={{ whiteSpace: "nowrap" }}>{diaSemana(f.fecha)}{f.feriado && <div style={gris}>feriado</div>}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{f.programado ? `${f.programado.ingreso}–${f.programado.salida}` : "franco"}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{hhmm(f.ingreso)}–{hhmm(f.egreso)}</td>
                            <td style={{ textAlign: "right" }}>{f.m50 ? textoHoras(f.m50) : ""}</td>
                            <td style={{ textAlign: "right" }}>{f.m100 ? textoHoras(f.m100) : ""}</td>
                            <td>
                              <select value={f.destino} onChange={(e) => cambiar({ destino: e.target.value })} aria-label="Qué hacer">
                                <option value="banco" disabled={!f.conAcuerdo}>Al banco{f.conAcuerdo ? "" : " (sin acuerdo)"}</option>
                                <option value="pagar">Pagar en el sueldo</option>
                                <option value="descartar">Descartar (no estaba autorizado)</option>
                              </select>
                              {f.alertas.map((a) => <div key={a} style={{ color: "#B23A3A", fontSize: "0.8rem", maxWidth: 300 }}>▲ {a}</div>)}
                            </td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                  <p style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {filas.some((f) => f.marcada && f.destino === "pagar") && (datos.periodos.length ? <label>Las que se pagan van al período <select value={periodoPago} onChange={(e) => setPeriodoPago(e.target.value)}>{datos.periodos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label> : <span style={{ color: "#B23A3A" }}>Para pagar hace falta un período de liquidación abierto.</span>)}
                    <button onClick={confirmar} disabled={!filas.some((f) => f.marcada)}>Confirmar {filas.filter((f) => f.marcada).length} {filas.filter((f) => f.marcada).length === 1 ? "día" : "días"}</button>
                  </p>
                  <p style={gris}>Las alertas marcan los topes de horas extra (3 diarias y 30 mensuales, Decretos 16.115/33 y 484/00), el descanso de 12 h entre jornadas y las 48 h semanales. No bloquean: son para revisar antes de confirmar.</p>
                </>
              )}
            </>
          )}

          {vista === "pedidos" && (
            <>
              {datos.pedidos.length === 0 && <p style={gris}>No hay pedidos sin responder.</p>}
              {datos.pedidos.map((x) => (
                <div key={x.id} style={{ ...caja, padding: "0.7rem 1rem" }}>
                  <strong>{x.nombre}</strong> <span style={gris}>· {x.sector}</span>
                  <div style={{ margin: "0.3rem 0" }}>{x.tipo === "pago" ? `Pide cobrar ${textoHoras(x.minutos)} del banco.` : `Pide usar ${textoHoras(x.minutos)} el ${diaSemana(x.fecha)}.`} <span style={gris}>Tiene {textoHoras(x.saldo)} en el banco · pedido el {dia(x.pedidoEn)}</span></div>
                  {x.motivo && <div style={{ fontSize: "0.9rem", marginBottom: 4 }}>“{x.motivo}”</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {x.tipo === "pago" && (datos.periodos.length ? <select aria-label="Período" value={periodoPedido[x.id] ?? datos.periodos[0].id} onChange={(e) => setPeriodoPedido({ ...periodoPedido, [x.id]: e.target.value })}>{datos.periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select> : <span style={{ color: "#B23A3A" }}>No hay período abierto.</span>)}
                    <button style={chico} onClick={() => accion({ accion: "resolver", id: x.id, aprobar: true, periodoId: periodoPedido[x.id] ?? datos.periodos[0]?.id }, "Pedido aprobado. Le llegó el aviso.")}>Aprobar</button>
                    <button style={{ ...btnSec, ...chico }} onClick={() => { const motivo = window.prompt("¿Por qué no? Lo va a ver la persona (podés dejarlo vacío)."); if (motivo !== null) accion({ accion: "resolver", id: x.id, aprobar: false, motivo }, "Pedido rechazado. Le llegó el aviso."); }}>Rechazar</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </main>
  );
}

function PersonaFila({ p, elegible, elegido, onElegir, abierta, onAbrir, chip, children }: { p: Persona; elegible: boolean; elegido: boolean; onElegir: (v: boolean) => void; abierta: boolean; onAbrir: () => void; chip: React.ReactNode; children: React.ReactNode }) {
  const avisos = [p.acuerdo?.estado === "sin_firmar" && "falta la firma", p.pendientes > 0 && `${p.pendientes} ${p.pendientes === 1 ? "pedido" : "pedidos"}`, p.egreso && p.saldo > 0 && `se va el ${dia(p.egreso)}: pagar el saldo`, p.vencido > 0 && "horas vencidas"].filter(Boolean);
  return (
    <>
      <tr style={{ borderTop: "1px solid #eef1f4" }}>
        <td>{elegible && <input type="checkbox" checked={elegido} onChange={(e) => onElegir(e.target.checked)} aria-label={`Elegir ${p.nombre}`} />}</td>
        <td><strong>{p.nombre}</strong><div style={gris}>Leg. {p.legajo} · {p.sector}</div></td>
        <td>{chip}</td>
        <td style={{ textAlign: "right", fontWeight: 600 }}>{p.saldo || p.movimientos ? textoHoras(p.saldo) : ""}</td>
        <td style={{ textAlign: "right", color: p.porVencer ? "#8a5413" : undefined }}>{p.porVencer ? textoHoras(p.porVencer) : ""}</td>
        <td style={{ textAlign: "right", color: p.vencido ? "#B23A3A" : undefined }}>{p.vencido ? textoHoras(p.vencido) : ""}</td>
        <td style={{ fontSize: "0.82rem", color: "#8a5413" }}>{avisos.join(" · ")}</td>
        <td><button style={chico} onClick={onAbrir}>{abierta ? "Cerrar" : "Ver"}</button></td>
      </tr>
      {abierta && <tr><td colSpan={8} style={{ padding: 0 }}>{children}</td></tr>}
    </>
  );
}
