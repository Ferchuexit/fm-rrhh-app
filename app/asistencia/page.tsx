// FM RRHH — app/asistencia/page.tsx
//
// Grilla visual legajo x día, igual espíritu que tus hojas "ENERO 2 Q." del
// Excel, pero alimentada por AsistenciaDia (motor automático + correcciones
// manuales) en vez de fórmulas sueltas. Fase: pantalla del calendario —
// todavía no convierte a Novedad ni alimenta el Dashboard (eso viene después).
"use client";
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";

// Misma validación estricta que prisma/importar-fichadas.ts (CLI) — fecha
// ambigua tipo "1/7/2026" se RECHAZA, no se adivina. Ver esa vuelta: un
// "1/7/2026" tipeado como texto ya causó fichadas de julio guardadas como
// enero. Duplicado acá a propósito (es lógica de cliente, no puede
// importar el script de prisma/) — si se toca una copia, tocar la otra.
function normalizarFechaCliente(valor: unknown): { fecha: string | null; error: string | null } {
  if (valor instanceof Date) {
    return { fecha: valor.toISOString().substring(0, 10), error: null };
  }
  if (typeof valor === "string") {
    const iso = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return { fecha: valor.trim(), error: null };
    const ambigua = valor.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ambigua) {
      return { fecha: null, error: `Fecha ambigua "${valor}" — formateá la columna Fecha como Fecha real en Excel, o usá "YYYY-MM-DD".` };
    }
    return { fecha: null, error: `Formato de fecha no reconocido: "${valor}".` };
  }
  return { fecha: null, error: "Celda de fecha vacía o de un tipo no reconocido." };
}

function normalizarHoraCliente(valor: unknown): string | null {
  if (valor instanceof Date) return valor.toISOString().substring(11, 19);
  if (typeof valor === "number") {
    const totalSegundos = Math.round(valor * 86400);
    const h = Math.floor(totalSegundos / 3600) % 24;
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }
  if (typeof valor === "string") {
    const m = valor.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?/);
    if (!m) return null;
    return `${m[1].padStart(2, "0")}:${m[2]}:${m[4] ?? "00"}`;
  }
  return null;
}

const NOMBRES_ESTADO: Record<string, string> = {
  P: "Presente",
  T: "Llegada tarde",
  SA: "Salida anticipada",
  A: "Ausente",
  S: "Sábado trabajado",
  F: "Feriado",
  E: "Licencia por enfermedad",
  ES: "Licencia por enfermedad, sábado",
  AA: "Ausente con aviso",
  AAS: "Ausente con aviso, sábado",
  AC: "Día por ART",
  ACS: "Día por ART, sábado",
  SUS: "Suspensión",
  LP: "Licencia paga",
  VC: "Vacaciones",
  VCS: "Vacaciones, sábado",
  IMPAR: "Fichada impar — revisar",
  SIN_TURNO: "Sin turno cargado",
  SIN_CONTROL: "Sin control (obra)",
  FRANCO: "Franco",
};

// FRANCO y SIN_TURNO no muestran letra en la celda — franco es simplemente
// el día libre de la persona, y SIN_TURNO es un dato faltante que no hace
// falta gritar en cada celda (el borde punteado ya lo marca, y el tooltip
// lo explica al pasar el mouse).
const ESTADOS_SIN_TEXTO = new Set(["FRANCO", "SIN_TURNO", "SIN_CONTROL"]);

const ESTILO_ESTADO: Record<string, { bg: string; color: string; border?: string }> = {
  P: { bg: "rgba(47,111,94,0.12)", color: "var(--verde)" },
  T: { bg: "rgba(184,117,43,0.18)", color: "var(--ambar)" },
  SA: { bg: "rgba(127,168,198,0.30)", color: "var(--azul-oscuro)" },
  A: { bg: "rgba(178,58,58,0.14)", color: "var(--rojo)" },
  S: { bg: "rgba(127,168,198,0.20)", color: "var(--azul-oscuro)" },
  F: { bg: "rgba(74,79,88,0.15)", color: "var(--gris-oscuro)" },
  E: { bg: "rgba(22,58,92,0.10)", color: "var(--azul-oscuro)" },
  ES: { bg: "rgba(22,58,92,0.10)", color: "var(--azul-oscuro)" },
  AA: { bg: "rgba(178,58,58,0.10)", color: "var(--rojo)", border: "1px dashed var(--rojo)" },
  AAS: { bg: "rgba(178,58,58,0.10)", color: "var(--rojo)", border: "1px dashed var(--rojo)" },
  AC: { bg: "rgba(184,117,43,0.12)", color: "var(--ambar)" },
  ACS: { bg: "rgba(184,117,43,0.12)", color: "var(--ambar)" },
  SUS: { bg: "rgba(178,58,58,0.20)", color: "var(--rojo)" },
  LP: { bg: "rgba(47,111,94,0.10)", color: "var(--verde)" },
  VC: { bg: "rgba(127,168,198,0.35)", color: "var(--azul-oscuro)" },
  VCS: { bg: "rgba(127,168,198,0.35)", color: "var(--azul-oscuro)" },
  IMPAR: { bg: "rgba(178,58,58,0.10)", color: "var(--rojo)", border: "1px dashed var(--rojo)" },
  SIN_TURNO: { bg: "#fff", color: "var(--gris-oscuro)", border: "1px dashed #cfd6dc" },
  SIN_CONTROL: { bg: "#fff", color: "#c7cbd1" },
  FRANCO: { bg: "var(--gris-claro)", color: "var(--gris-oscuro)" },
};

const OPCIONES_MANUAL = ["P", "A", "T", "SA", "S", "F", "E", "ES", "AA", "AAS", "AC", "ACS", "SUS", "LP", "VC", "VCS", "FRANCO"];

const DIAS_SEMANA_CORTO = ["D", "L", "M", "M", "J", "V", "S"];

function fechaISO(d: Date) {
  return d.toISOString().substring(0, 10);
}

function primerYUltimoDiaMes(anio: number, mes: number) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const ultimo = new Date(Date.UTC(anio, mes, 0));
  return { desde: fechaISO(primero), hasta: fechaISO(ultimo) };
}

export default function AsistenciaPage() {
  const hoy = new Date();

  const [modo, setModo] = useState<"quincena" | "mes" | "rango">("mes");
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [rangoDesde, setRangoDesde] = useState(fechaISO(hoy));
  const [rangoHasta, setRangoHasta] = useState(fechaISO(hoy));

  const [convenios, setConvenios] = useState<any[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloLegajoId, setSoloLegajoId] = useState<string | null>(null); // "histórico por legajo"

  const [datos, setDatos] = useState<{ legajos: any[]; dias: string[]; celdas: Record<string, Record<string, any>>; diasCerrados: string[] } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState<{ legajoId: string; fecha: string } | null>(null);

  // ── Importar / Clasificar / Cerrar período ──
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [filasParaImportar, setFilasParaImportar] = useState<{ numeroLegajo: number; fecha: string; hora: string }[]>([]);
  const [erroresImport, setErroresImport] = useState<string[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [resultadoImport, setResultadoImport] = useState<any>(null);
  const [importando, setImportando] = useState(false);
  const [clasificando, setClasificando] = useState(false);
  const [resultadoClasificar, setResultadoClasificar] = useState<any>(null);
  const [nombreCierre, setNombreCierre] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState("");
  const [periodosAsistencia, setPeriodosAsistencia] = useState<any[]>([]);
  const [reabriendoId, setReabriendoId] = useState<string | null>(null);
  const [borrDesde, setBorrDesde] = useState("");
  const [borrHasta, setBorrHasta] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [resultadoBorrado, setResultadoBorrado] = useState<any>(null);

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then(setPeriodos);
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
    cargarPeriodosAsistencia();
  }, []);

  function cargarPeriodosAsistencia() {
    fetch("/api/periodos-asistencia").then((r) => r.json()).then(setPeriodosAsistencia);
  }

  // ── Rango de fechas efectivo, según el modo elegido ──
  const { desde, hasta } = useMemo(() => {
    if (soloLegajoId) {
      // Histórico por legajo: rango amplio, no depende del modo.
      const d = new Date(hoy);
      d.setUTCDate(d.getUTCDate() - 90);
      return { desde: fechaISO(d), hasta: fechaISO(hoy) };
    }
    if (modo === "quincena") {
      const p = periodos.find((p) => p.id === periodoId);
      if (!p) return { desde: "", hasta: "" };
      return { desde: p.fechaDesde.substring(0, 10), hasta: p.fechaHasta.substring(0, 10) };
    }
    if (modo === "mes") {
      return primerYUltimoDiaMes(anio, mes);
    }
    return { desde: rangoDesde, hasta: rangoHasta };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, periodoId, anio, mes, rangoDesde, rangoHasta, soloLegajoId, periodos.length]);

  async function cargar() {
    if (!desde || !hasta) { setDatos(null); return; }
    setCargando(true);
    setError("");
    const params = new URLSearchParams({ desde, hasta });
    if (convenioId && !soloLegajoId) params.set("convenioId", convenioId);
    if (soloLegajoId) params.set("legajoId", soloLegajoId);
    try {
      const res = await fetch(`/api/asistencia?${params}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "No se pudo cargar."); setDatos(null); return; }
      setDatos(data);
    } catch {
      setError("El servidor no devolvió una respuesta válida.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, convenioId, soloLegajoId]);

  useEffect(() => {
    if (desde && hasta) { setBorrDesde(desde); setBorrHasta(hasta); }
  }, [desde, hasta]);

  async function reabrirPeriodo(id: string, nombre: string) {
    const motivo = window.prompt(`¿Por qué reabrís "${nombre}"? (queda registrado)`);
    if (!motivo?.trim()) return;
    setReabriendoId(id);
    try {
      const res = await fetch(`/api/periodos-asistencia/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "No se pudo reabrir."); return; }
      cargarPeriodosAsistencia();
      cargar();
    } catch {
      alert("El servidor no devolvió una respuesta válida.");
    } finally {
      setReabriendoId(null);
    }
  }

  async function borrarFichadasRango() {
    if (!borrDesde || !borrHasta) return;
    if (!confirm(`¿Borrar todas las fichadas y su clasificación automática entre ${borrDesde} y ${borrHasta}? No se puede deshacer. Las correcciones manuales no se tocan.`)) {
      return;
    }
    setBorrando(true);
    setResultadoBorrado(null);
    try {
      const res = await fetch("/api/asistencia", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde: borrDesde, hasta: borrHasta }),
      });
      const data = await res.json();
      setResultadoBorrado(res.ok ? data : { error: data.error ?? "No se pudo borrar." });
      if (res.ok) cargar();
    } catch {
      setResultadoBorrado({ error: "El servidor no devolvió una respuesta válida." });
    } finally {
      setBorrando(false);
    }
  }

  async function guardarManual(legajoId: string, fecha: string, estado: string) {
    setEditando(null);
    const res = await fetch("/api/asistencia", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legajoId, fecha, estado }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "No se pudo guardar la corrección.");
    }
    cargar();
  }

  // ── Importar Excel ──
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivo(file.name);
    setResultadoImport(null);
    setResultadoClasificar(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filasCrudas: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

      const filasOk: { numeroLegajo: number; fecha: string; hora: string }[] = [];
      const errores: string[] = [];

      filasCrudas.forEach((fila, i) => {
        const numeroLegajo = Number(fila["Leg."] ?? fila["Legajo"] ?? fila["LEG"] ?? fila["leg"]);
        const { fecha, error: errorFecha } = normalizarFechaCliente(fila["Fecha"] ?? fila["FECHA"]);
        const hora = normalizarHoraCliente(fila["Hora"] ?? fila["HORA"]);

        if (errorFecha) { errores.push(`Fila ${i + 2} (legajo ${fila["Leg."] ?? fila["Legajo"] ?? "?"}): ${errorFecha}`); return; }
        if (!numeroLegajo || !fecha || !hora) { errores.push(`Fila ${i + 2}: legajo, fecha u hora incompletos.`); return; }
        filasOk.push({ numeroLegajo, fecha, hora });
      });

      setFilasParaImportar(filasOk);
      setErroresImport(errores);
    };
    reader.readAsArrayBuffer(file);
  }

  async function importar() {
    if (filasParaImportar.length === 0) return;
    setImportando(true);
    setResultadoImport(null);
    try {
      const res = await fetch("/api/asistencia/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas: filasParaImportar }),
      });
      const data = await res.json();
      setResultadoImport(res.ok ? data : { error: data.error ?? "No se pudo importar." });
    } catch {
      setResultadoImport({ error: "El servidor no devolvió una respuesta válida." });
    } finally {
      setImportando(false);
    }
  }

  async function clasificarRango() {
    if (!desde || !hasta) return;
    setClasificando(true);
    setResultadoClasificar(null);
    try {
      const res = await fetch("/api/asistencia/clasificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde, hasta }),
      });
      const data = await res.json();
      setResultadoClasificar(res.ok ? data : { error: data.error ?? "No se pudo clasificar." });
      if (res.ok) cargar();
    } catch {
      setResultadoClasificar({ error: "El servidor no devolvió una respuesta válida." });
    } finally {
      setClasificando(false);
    }
  }

  async function cerrarPeriodo() {
    if (!nombreCierre.trim() || !desde || !hasta) return;
    if (!confirm(`¿Cerrar "${nombreCierre}" (${desde} a ${hasta})? Una vez cerrado, esos días no se van a poder editar ni reclasificar sin reabrir el período primero.`)) {
      return;
    }
    setCerrando(true);
    setErrorCierre("");
    try {
      const res = await fetch("/api/periodos-asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreCierre.trim(), fechaDesde: desde, fechaHasta: hasta }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorCierre(data.error ?? "No se pudo cerrar el período."); return; }
      setNombreCierre("");
      cargarPeriodosAsistencia();
      cargar();
    } catch {
      setErrorCierre("El servidor no devolvió una respuesta válida.");
    } finally {
      setCerrando(false);
    }
  }

  const legajosFiltrados = useMemo(() => {
    if (!datos) return [];
    if (!busqueda.trim()) return datos.legajos;
    const q = busqueda.trim().toLowerCase();
    return datos.legajos.filter(
      (l) => String(l.numero).includes(q) || l.apellido.toLowerCase().includes(q) || l.nombre.toLowerCase().includes(q)
    );
  }, [datos, busqueda]);

  return (
    <main>
      <h1>Asistencia</h1>
      <p style={{ opacity: 0.7, marginTop: "-0.5rem" }}>
        Grilla de presentes/ausentes por período, calculada desde las fichadas del reloj. Hacé clic en una celda para corregirla a mano (licencias, vacaciones, feriados, o un error del motor).
      </p>

      {/* ── Filtros ── */}
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        {soloLegajoId ? (
          <div>
            <p style={{ margin: 0 }}>
              Viendo histórico (últimos 90 días) de <strong>{datos?.legajos.find((l) => l.id === soloLegajoId)?.apellido ?? "..."}</strong>.
            </p>
            <button onClick={() => setSoloLegajoId(null)} style={{ marginTop: "0.4rem" }}>← Volver a la grilla completa</button>
          </div>
        ) : (
          <>
            <label>
              Ver por<br />
              <select value={modo} onChange={(e) => setModo(e.target.value as any)}>
                <option value="mes">Mes completo</option>
                <option value="quincena">Quincena (período existente)</option>
                <option value="rango">Rango personalizado</option>
              </select>
            </label>

            {modo === "mes" && (
              <>
                <label>Mes<br />
                  <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                    {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((n, i) => (
                      <option key={i} value={i + 1}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>Año<br />
                  <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: "80px" }} />
                </label>
              </>
            )}

            {modo === "quincena" && (
              <label>Período<br />
                <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
                  <option value="">Elegir...</option>
                  {periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
            )}

            {modo === "rango" && (
              <>
                <label>Desde<br /><input type="date" value={rangoDesde} onChange={(e) => setRangoDesde(e.target.value)} /></label>
                <label>Hasta<br /><input type="date" value={rangoHasta} onChange={(e) => setRangoHasta(e.target.value)} /></label>
              </>
            )}

            <label>Convenio<br />
              <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
                <option value="">Todos</option>
                {convenios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>

            <label>Buscar legajo<br />
              <input type="text" placeholder="Número o apellido..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </label>
          </>
        )}
      </div>

      {/* ── Importar / Clasificar / Cerrar período ── */}
      {!soloLegajoId && (
        <div style={{ marginBottom: "1.25rem" }}>
          <button onClick={() => setPanelAbierto(!panelAbierto)} style={{ background: "white", color: "var(--azul-oscuro)", border: "1px solid #dfe4e8" }}>
            {panelAbierto ? "▾" : "▸"} Importar fichadas / clasificar / cerrar período
          </button>

          {panelAbierto && (
            <div style={{ background: "white", border: "1px solid #dfe4e8", borderTop: "none", padding: "1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Importar */}
              <div>
                <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>1. Importar fichadas del reloj</h4>
                <label style={{ display: "inline-block", padding: "0.5rem 1rem", border: "1px dashed #cfd6dc", cursor: "pointer", fontSize: "0.85rem" }}>
                  {nombreArchivo || "Elegir archivo (.xlsx)"}
                  <input type="file" accept=".xlsx,.xls" onChange={onFileChange} style={{ display: "none" }} />
                </label>

                {erroresImport.length > 0 && (
                  <div style={{ marginTop: "0.6rem", fontSize: "0.8rem", color: "var(--rojo)" }}>
                    ⚠ {erroresImport.length} fila(s) rechazadas:
                    <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem" }}>
                      {erroresImport.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                    {erroresImport.length > 10 && <p style={{ margin: "0.2rem 0 0" }}>...y {erroresImport.length - 10} más.</p>}
                  </div>
                )}

                {filasParaImportar.length > 0 && (
                  <p style={{ fontSize: "0.85rem", marginTop: "0.6rem" }}>
                    {filasParaImportar.length} fila(s) listas para importar.{" "}
                    <button onClick={importar} disabled={importando}>{importando ? "Importando..." : "Importar"}</button>
                  </p>
                )}

                {resultadoImport && (
                  resultadoImport.error ? (
                    <p style={{ color: "var(--rojo)", fontSize: "0.85rem" }}>{resultadoImport.error}</p>
                  ) : (
                    <div style={{ fontSize: "0.85rem", background: "var(--gris-claro)", padding: "0.6rem", marginTop: "0.5rem" }}>
                      <p style={{ margin: 0 }}>
                        ✔ Creadas: {resultadoImport.creadas} · Ya existían: {resultadoImport.saltadas}
                        {resultadoImport.enPeriodoCerrado > 0 && ` · En período cerrado (no se tocaron): ${resultadoImport.enPeriodoCerrado}`}
                      </p>
                      {resultadoImport.fechaMin && (
                        <p style={{ margin: "0.3rem 0 0" }}>
                          📅 Rango detectado: {resultadoImport.fechaMin} a {resultadoImport.fechaMax}. Confirmá que sea el que esperabas.
                        </p>
                      )}
                      {resultadoImport.sinLegajo > 0 && (
                        <p style={{ margin: "0.3rem 0 0", color: "var(--ambar)" }}>
                          ⚠ {resultadoImport.sinLegajo} fichada(s) de legajos no encontrados: {resultadoImport.legajosNoEncontrados.join(", ")}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Clasificar */}
              <div>
                <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>2. Clasificar el rango que estás viendo ({desde || "—"} a {hasta || "—"})</h4>
                <button onClick={clasificarRango} disabled={clasificando || !desde}>
                  {clasificando ? "Clasificando..." : "Clasificar este rango"}
                </button>
                {resultadoClasificar && (
                  resultadoClasificar.error ? (
                    <p style={{ color: "var(--rojo)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{resultadoClasificar.error}</p>
                  ) : (
                    <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                      ✔ Días procesados: {resultadoClasificar.procesados} · Con carga manual (no tocados): {resultadoClasificar.saltadosPorManual} · En período cerrado: {resultadoClasificar.saltadosPorCierre}
                    </p>
                  )
                )}
              </div>

              {/* Cerrar período */}
              <div>
                <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>3. Cerrar este rango como histórico</h4>
                <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 0 }}>
                  Una vez cerrado, estos días quedan protegidos — no se pueden editar ni reclasificar por error. Los indicadores del dashboard van a poder confiar en que un período cerrado no cambia.
                </p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder='Nombre, ej. "Julio 2026"'
                    value={nombreCierre}
                    onChange={(e) => setNombreCierre(e.target.value)}
                    style={{ width: "220px" }}
                  />
                  <button onClick={cerrarPeriodo} disabled={cerrando || !nombreCierre.trim() || !desde}>
                    {cerrando ? "Cerrando..." : "Cerrar período"}
                  </button>
                </div>
                {errorCierre && <p style={{ color: "var(--rojo)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{errorCierre}</p>}

                {periodosAsistencia.length > 0 && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 500, margin: "0 0 0.3rem" }}>Períodos ya registrados:</p>
                    <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.8rem" }}>
                      {periodosAsistencia.map((p) => (
                        <li key={p.id} style={{ marginBottom: "0.25rem" }}>
                          <strong>{p.nombre}</strong> ({p.fechaDesde.substring(0, 10)} a {p.fechaHasta.substring(0, 10)}) — {p.estado}
                          {p.estado === "cerrado" && (
                            <>
                              {" "}
                              <button
                                onClick={() => reabrirPeriodo(p.id, p.nombre)}
                                disabled={reabriendoId === p.id}
                                style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem" }}
                              >
                                {reabriendoId === p.id ? "..." : "Reabrir"}
                              </button>
                            </>
                          )}
                          {p.estado === "reabierto" && p.motivoReapertura && (
                            <span style={{ opacity: 0.6 }}> — reabierto: "{p.motivoReapertura}"</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Borrar fichadas por rango */}
              <div>
                <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>4. Borrar fichadas por rango</h4>
                <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 0 }}>
                  Para limpiar datos de prueba antes de reimportar o cargar a mano. Borra las fichadas crudas y su clasificación automática — las correcciones manuales (licencias, vacaciones, etc.) no se tocan. No funciona sobre un período cerrado.
                </p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <label>Desde<br /><input type="date" value={borrDesde} onChange={(e) => setBorrDesde(e.target.value)} /></label>
                  <label>Hasta<br /><input type="date" value={borrHasta} onChange={(e) => setBorrHasta(e.target.value)} /></label>
                  <button onClick={borrarFichadasRango} disabled={borrando || !borrDesde || !borrHasta} style={{ background: "var(--rojo)" }}>
                    {borrando ? "Borrando..." : "Borrar fichadas de este rango"}
                  </button>
                </div>
                {resultadoBorrado && (
                  resultadoBorrado.error ? (
                    <p style={{ color: "var(--rojo)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{resultadoBorrado.error}</p>
                  ) : (
                    <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                      ✔ Fichadas borradas: {resultadoBorrado.fichadasBorradas} · Clasificaciones automáticas borradas: {resultadoBorrado.asistenciasBorradas}
                    </p>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: "var(--rojo)" }}>{error}</p>}
      {cargando && <p style={{ opacity: 0.6 }}>Cargando...</p>}

      {!cargando && datos && datos.dias.length > 0 && (
        <>
          {/* ── Grilla ── */}
          <div style={{ overflowX: "auto", background: "white", border: "1px solid #dfe4e8" }}>
            <table style={{ maxWidth: "none", fontSize: "0.78rem" }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, background: "var(--azul-oscuro)", zIndex: 1, minWidth: "170px" }}>Legajo</th>
                  {datos.dias.map((f) => {
                    const d = new Date(f + "T00:00:00.000Z");
                    const finde = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                    const cerrado = datos.diasCerrados.includes(f);
                    return (
                      <th key={f} style={{ textAlign: "center", padding: "0.4rem 0.3rem", minWidth: "34px", opacity: finde ? 0.55 : 1 }} title={cerrado ? "Período cerrado — no editable" : undefined}>
                        {cerrado && "🔒"}{DIAS_SEMANA_CORTO[d.getUTCDay()]}<br />{d.getUTCDate()}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {legajosFiltrados.map((l) => (
                  <tr key={l.id}>
                    <td
                      style={{ position: "sticky", left: 0, background: "white", cursor: "pointer", fontWeight: 500 }}
                      onClick={() => setSoloLegajoId(l.id)}
                      title="Ver histórico de este legajo"
                    >
                      {l.numero} — {l.apellido}, {l.nombre}
                      {!l.fichadaObligatoria && <span style={{ opacity: 0.5, fontSize: "0.7rem" }}> (obra)</span>}
                    </td>
                    {datos.dias.map((f) => {
                      const celda = datos.celdas[l.id]?.[f];
                      const estado = celda?.estado;
                      const estilo = estado ? ESTILO_ESTADO[estado] : { bg: "#fafafa", color: "#ccc" };
                      const editandoEsta = editando?.legajoId === l.id && editando?.fecha === f;
                      const cerrado = datos.diasCerrados.includes(f);

                      return (
                        <td
                          key={f}
                          onClick={() => !cerrado && setEditando({ legajoId: l.id, fecha: f })}
                          title={
                            cerrado
                              ? "Período cerrado — no editable"
                              : celda
                              ? `${NOMBRES_ESTADO[estado] ?? estado}${celda.horaIngresoReal ? ` — ingreso ${celda.horaIngresoReal.substring(0,5)}` : ""}${celda.horaEgresoReal ? `, egreso ${celda.horaEgresoReal.substring(0,5)}` : ""}${celda.minutosTarde ? ` (${celda.minutosTarde} min tarde)` : ""}${celda.minutosSalidaAnticipada ? ` (${celda.minutosSalidaAnticipada} min antes)` : ""}`
                              : "Sin datos"
                          }
                          style={{
                            textAlign: "center",
                            padding: 0,
                            cursor: cerrado ? "default" : "pointer",
                            background: estilo.bg,
                            color: estilo.color,
                            border: estilo.border ?? undefined,
                            fontWeight: 600,
                            opacity: cerrado ? 0.75 : 1,
                          }}
                        >
                          {editandoEsta ? (
                            <select
                              autoFocus
                              defaultValue={estado ?? "P"}
                              onBlur={() => setEditando(null)}
                              onChange={(e) => guardarManual(l.id, f, e.target.value)}
                              style={{ width: "100%", border: "none", fontSize: "0.72rem" }}
                            >
                              {OPCIONES_MANUAL.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <div style={{ padding: "0.45rem 0" }}>
                              {estado && !ESTADOS_SIN_TEXTO.has(estado) ? estado : ""}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {legajosFiltrados.length === 0 && <p style={{ opacity: 0.6, marginTop: "1rem" }}>Ningún legajo coincide con la búsqueda.</p>}

          {/* ── Referencias ── */}
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.9rem", flexWrap: "wrap", fontSize: "0.78rem" }}>
            {Object.entries(NOMBRES_ESTADO).map(([codigo, nombre]) => (
              <span key={codigo} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ background: ESTILO_ESTADO[codigo].bg, color: ESTILO_ESTADO[codigo].color, border: ESTILO_ESTADO[codigo].border, padding: "0.1rem 0.4rem", fontWeight: 600, borderRadius: "3px" }}>
                  {codigo}
                </span>
                {nombre}
              </span>
            ))}
          </div>
        </>
      )}

      {!cargando && datos && datos.dias.length === 0 && (
        <p style={{ opacity: 0.6 }}>Elegí un período para ver la grilla.</p>
      )}
    </main>
  );
}
