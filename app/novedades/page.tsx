"use client";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

// Datos de ejemplo con errores a propósito, para probar la validación sin
// tener que armar un Excel — sigue disponible como botón aparte.
const FILAS_EJEMPLO = [
  { legajoNumero: 4, fecha: "2026-07-10", conceptoCodigo: "HS_EXTRA_50", cantidad: 8 },
  { legajoNumero: 4, fecha: "2026-07-15", conceptoCodigo: "ADELANTO", valor: -50000 },
  { legajoNumero: 999, fecha: "2026-07-10", conceptoCodigo: "HS_EXTRA_50", cantidad: 5 },
  { legajoNumero: 12, fecha: "2026-08-05", conceptoCodigo: "HS_EXTRA_50", cantidad: 5 },
  { legajoNumero: 4, fecha: "2026-07-12", conceptoCodigo: "CONCEPTO_FANTASMA", cantidad: 5 },
];

export default function NovedadesPage() {
  const [periodoId, setPeriodoId] = useState("");
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [filas, setFilas] = useState<any[]>([]);
  const [resultado, setResultado] = useState<any>(null);
  const [confirmado, setConfirmado] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");

  const [legajos, setLegajos] = useState<any[]>([]);
  const [conceptos, setConceptos] = useState<any[]>([]);
  const [manual, setManual] = useState({ legajoNumero: "", fecha: "", conceptoCodigo: "", cantidad: "", valor: "" });

  const [convenios, setConvenios] = useState<any[]>([]);
  const [modoBorrado, setModoBorrado] = useState<"todos" | "convenio" | "rango">("todos");
  const [convenioIdBorrado, setConvenioIdBorrado] = useState("");
  const [legajoDesdeBorrado, setLegajoDesdeBorrado] = useState("");
  const [legajoHastaBorrado, setLegajoHastaBorrado] = useState("");
  const [conceptoBorrado, setConceptoBorrado] = useState("");
  const [borrando, setBorrando] = useState(false);

  const [novedadesCargadas, setNovedadesCargadas] = useState<any[]>([]);
  const [cargandoConsulta, setCargandoConsulta] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState("");
  const [filtroConsulta, setFiltroConsulta] = useState("");
  const [mostrarConsulta, setMostrarConsulta] = useState(false);

  function cargarNovedadesDelPeriodo() {
    if (!periodoId) { setNovedadesCargadas([]); return; }
    setCargandoConsulta(true);
    setErrorConsulta("");
    fetch(`/api/novedades?periodoId=${periodoId}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error ?? `El servidor respondió ${r.status} — puede que falte aplicar app/api/novedades/route.ts con el método GET.`);
        setNovedadesCargadas(Array.isArray(data) ? data : []);
      })
      .catch((e) => { setErrorConsulta(e.message); setNovedadesCargadas([]); })
      .finally(() => setCargandoConsulta(false));
  }

  useEffect(() => {
    if (mostrarConsulta) cargarNovedadesDelPeriodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoId, mostrarConsulta]);

  async function borrarNovedadIndividual(id: string) {
    if (!confirm("¿Borrar esta novedad puntual? No se puede deshacer.")) return;
    await fetch(`/api/novedades/${id}`, { method: "DELETE" });
    cargarNovedadesDelPeriodo();
  }

  const novedadesFiltradas = novedadesCargadas.filter((n) => {
    if (!filtroConsulta.trim()) return true;
    const q = filtroConsulta.trim().toLowerCase();
    return String(n.legajoNumero).includes(q) || n.legajoNombre.toLowerCase().includes(q) || n.conceptoCodigo.toLowerCase().includes(q);
  });

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then((ps) => {
      setPeriodos(ps);
      const desdeUrl = new URLSearchParams(window.location.search).get("periodoId");
      setPeriodoId(desdeUrl && ps.some((p: any) => p.id === desdeUrl) ? desdeUrl : ps[0]?.id ?? "");
    });
  }, []);

  // Conceptos no depende del período — se pide siempre, apenas carga la pantalla.
  useEffect(() => {
    fetch("/api/conceptos").then((r) => r.json()).then((d) => setConceptos(d.conceptos));
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
  }, []);

  // Legajos sí depende del período (se filtran por la empresa de ese período).
  useEffect(() => {
    if (!periodoId) return;
    fetch(`/api/legajos?periodoId=${periodoId}`)
      .then((r) => r.json())
      .then((d) => setLegajos(Array.isArray(d) ? d : []))
      .catch(() => setLegajos([]));
  }, [periodoId]);

  // ── Subida real de Excel/CSV ──
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivo(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filasCrudas: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const normalizadas = filasCrudas.map((r) => ({
        legajoNumero: r.legajoNumero ?? r.Legajo ?? r.legajo,
        fecha: typeof r.fecha === "number" ? XLSX.SSF.format("yyyy-mm-dd", r.fecha) : (r.fecha ?? r.Fecha),
        conceptoCodigo: r.conceptoCodigo ?? r.Concepto ?? r.concepto,
        cantidad: r.cantidad ?? r.Cantidad ?? undefined,
        valor: r.valor ?? r.Valor ?? undefined,
      }));
      setFilas(normalizadas);
      setResultado(null);
      setConfirmado(null);
    };
    reader.readAsArrayBuffer(file);
  }

  function cargarEjemplo() {
    setNombreArchivo("(datos de ejemplo, con errores a propósito)");
    setFilas(FILAS_EJEMPLO);
    setResultado(null);
    setConfirmado(null);
  }

  // ── Alta manual individual — para ajustar una sola liquidación, una
  // vacación o una liquidación final sin tener que armar un Excel entero ──
  function agregarFilaManual() {
    if (!manual.legajoNumero || !manual.fecha || !manual.conceptoCodigo) {
      alert("Completá legajo, fecha y concepto.");
      return;
    }
    setFilas([
      ...filas,
      {
        legajoNumero: Number(manual.legajoNumero),
        fecha: manual.fecha,
        conceptoCodigo: manual.conceptoCodigo,
        cantidad: manual.cantidad ? Number(manual.cantidad) : undefined,
        valor: manual.valor ? Number(manual.valor) : undefined,
      },
    ]);
    setManual({ legajoNumero: "", fecha: "", conceptoCodigo: "", cantidad: "", valor: "" });
    setResultado(null);
    setConfirmado(null);
  }

  function quitarFila(i: number) {
    setFilas(filas.filter((_, idx) => idx !== i));
    setResultado(null);
  }

  function categoriaDe(codigo: string) {
    return conceptos.find((c) => c.codigo === codigo)?.categoriaNovedad ?? "—";
  }

  async function validar() {
    if (!periodoId || filas.length === 0) {
      if (filas.length === 0) alert("No hay ninguna fila cargada todavía — subí un Excel, cargá el ejemplo, o agregá una fila manual.");
      return;
    }
    setCargando(true);
    setConfirmado(null);
    const res = await fetch("/api/novedades/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId, filas }),
    });
    try {
      setResultado(await res.json());
    } catch {
      setResultado({ error: "El servidor no devolvió una respuesta válida." });
    }
    setCargando(false);
  }

  async function confirmar() {
    const filasValidas = resultado.filas.filter((f: any) => f.estado === "valida");
    const res = await fetch("/api/novedades/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId, filasValidas }),
    });
    try {
      setConfirmado(await res.json());
      if (mostrarConsulta) cargarNovedadesDelPeriodo();
    } catch {
      setConfirmado({ error: "El servidor no devolvió una respuesta válida." });
    }
  }

  async function eliminarNovedades() {
    if (!periodoId) return;
    const desc =
      modoBorrado === "todos" ? "TODAS las novedades de este período" : modoBorrado === "convenio" ? "las novedades de este convenio" : "las novedades de este rango de legajo";
    const descConcepto = conceptoBorrado ? ` (solo del concepto elegido)` : "";
    if (!confirm(`¿Eliminar ${desc}${descConcepto}? No se puede deshacer.`)) return;

    setBorrando(true);
    const res = await fetch("/api/novedades", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodoId,
        filtro: {
          modo: modoBorrado,
          convenioId: modoBorrado === "convenio" ? convenioIdBorrado : undefined,
          legajoDesde: modoBorrado === "rango" && legajoDesdeBorrado ? Number(legajoDesdeBorrado) : undefined,
          legajoHasta: modoBorrado === "rango" && legajoHastaBorrado ? Number(legajoHastaBorrado) : undefined,
        },
        conceptoCodigo: conceptoBorrado || undefined,
      }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      setBorrando(false);
      alert("El servidor no devolvió una respuesta válida.");
      return;
    }
    setBorrando(false);
    if (!res.ok) {
      alert(data.error);
      return;
    }
    alert(`${data.eliminadas} novedad(es) eliminada(s).`);
    if (mostrarConsulta) cargarNovedadesDelPeriodo();
  }

  return (
    <main>
      <h1>Importar novedades</h1>
      <p>
        Elegí el período — las novedades quedan asociadas a él.
      </p>
      <select
        value={periodoId}
        onChange={(e) => setPeriodoId(e.target.value)}
        style={{ marginRight: "0.5rem", marginBottom: "1rem", display: "block" }}
      >
        {periodos.length === 0 && <option value="">No hay períodos cargados todavía</option>}
        {periodos.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>
        ))}
      </select>
      {!periodoId && (
        <p style={{ color: "#B8752B", fontSize: "0.85rem" }}>
          ⚠ Todavía no hay ningún período creado — creá uno primero en <a href="/periodos">/periodos</a>.
        </p>
      )}

      {/* ── Consultar novedades ya cargadas ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button onClick={() => setMostrarConsulta(!mostrarConsulta)} style={{ background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
          {mostrarConsulta ? "▾" : "▸"} Ver novedades ya cargadas en este período
        </button>
        {mostrarConsulta && (
          <div style={{ background: "white", border: "1px solid #dfe4e8", borderTop: "none", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "0.8rem" }}>
              <input
                type="text"
                placeholder="Buscar por legajo, apellido o concepto..."
                value={filtroConsulta}
                onChange={(e) => setFiltroConsulta(e.target.value)}
                style={{ width: "280px" }}
              />
              <button onClick={cargarNovedadesDelPeriodo} disabled={cargandoConsulta} style={{ fontSize: "0.8rem" }}>
                {cargandoConsulta ? "Actualizando..." : "↻ Actualizar"}
              </button>
              <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>{novedadesFiltradas.length} de {novedadesCargadas.length}</span>
            </div>
            {cargandoConsulta ? (
              <p style={{ opacity: 0.6 }}>Cargando...</p>
            ) : errorConsulta ? (
              <p style={{ color: "#B23A3A" }}>{errorConsulta}</p>
            ) : novedadesCargadas.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No hay ninguna novedad cargada todavía para este período.</p>
            ) : (
              <table style={{ fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th>Legajo</th><th>Fecha</th><th>Concepto</th><th style={{ textAlign: "right" }}>Cant.</th>
                    <th style={{ textAlign: "right" }}>Valor</th><th>Estado</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {novedadesFiltradas.map((n) => (
                    <tr key={n.id}>
                      <td>{n.legajoNumero} — {n.legajoNombre}</td>
                      <td>{n.fecha}</td>
                      <td title={n.conceptoNombre}>{n.conceptoCodigo}</td>
                      <td style={{ textAlign: "right" }}>{n.cantidad ?? ""}</td>
                      <td style={{ textAlign: "right" }}>{n.valor != null ? n.valor.toLocaleString("es-AR") : ""}</td>
                      <td style={{ color: n.estado === "con_error" ? "#B23A3A" : n.estado === "valida" ? "#2F6F5E" : undefined }}>{n.estado}</td>
                      <td>
                        <button onClick={() => borrarNovedadIndividual(n.id)} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A", fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Carga masiva ── */}
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "700px" }}>
        <h3 style={{ marginTop: 0 }}>Carga masiva (Excel)</h3>
        <label style={{ display: "inline-block", background: "#163A5C", color: "white", padding: "0.6rem 1.2rem", cursor: "pointer", borderRadius: "3px" }}>
          Elegir archivo (.xlsx / .csv)
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} style={{ display: "none" }} />
        </label>{" "}
        <button onClick={cargarEjemplo} style={{ background: "white", color: "#163A5C", border: "1px solid #163A5C" }}>
          Cargar datos de ejemplo
        </button>
        {nombreArchivo && <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>{nombreArchivo} — {filas.length} fila(s) cargada(s)</p>}
        <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Columnas esperadas: <code>legajoNumero, fecha, conceptoCodigo, cantidad, valor</code>
        </p>
      </div>

      {/* ── Alta manual individual ── */}
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "700px" }}>
        <h3 style={{ marginTop: 0 }}>Alta manual individual</h3>
        <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 0 }}>
          Para ajustar un solo legajo — una liquidación final, una vacación puntual, o corregir una sola novedad — sin
          tener que armar un Excel.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <select value={manual.legajoNumero} onChange={(e) => setManual({ ...manual, legajoNumero: e.target.value })}>
            <option value="">Legajo...</option>
            {legajos.map((l) => (
              <option key={l.id} value={l.numero}>{l.numero} — {l.apellido}, {l.nombre}</option>
            ))}
          </select>
          <input type="date" value={manual.fecha} onChange={(e) => setManual({ ...manual, fecha: e.target.value })} />
          <select value={manual.conceptoCodigo} onChange={(e) => setManual({ ...manual, conceptoCodigo: e.target.value })}>
            <option value="">Concepto...</option>
            {Object.entries(
              conceptos.reduce((grupos: Record<string, any[]>, c) => {
                const cat = c.categoriaNovedad ?? "Otros";
                (grupos[cat] ??= []).push(c);
                return grupos;
              }, {})
            ).map(([categoria, items]) => (
              <optgroup key={categoria} label={categoria}>
                {items.map((c: any) => (
                  <option key={c.id} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            type="number"
            placeholder="cantidad (horas)"
            value={manual.cantidad}
            onChange={(e) => setManual({ ...manual, cantidad: e.target.value })}
            style={{ width: "130px" }}
          />
          <input
            type="number"
            placeholder="valor ($)"
            value={manual.valor}
            onChange={(e) => setManual({ ...manual, valor: e.target.value })}
            style={{ width: "110px" }}
          />
          <button onClick={agregarFilaManual}>+ Agregar fila</button>
        </div>
      </div>

      {/* ── Filas pendientes de validar ── */}
      {filas.length > 0 && !resultado && (
        <div style={{ marginBottom: "1rem" }}>
          <h3>{filas.length} fila(s) lista(s) para validar</h3>
          <table>
            <thead>
              <tr><th>Legajo</th><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Cant.</th><th>Valor</th><th></th></tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  <td>{f.legajoNumero}</td>
                  <td>{f.fecha}</td>
                  <td style={{ fontSize: "0.8rem", opacity: 0.7 }}>{categoriaDe(f.conceptoCodigo)}</td>
                  <td>{f.conceptoCodigo}</td>
                  <td>{f.cantidad ?? ""}</td>
                  <td>{f.valor ?? ""}</td>
                  <td>
                    <button onClick={() => quitarFila(i)} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A", padding: "0.1rem 0.5rem", fontSize: "0.75rem" }}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={validar} disabled={cargando} style={{ marginTop: "0.75rem" }}>
            {cargando ? "Validando..." : `Validar ${filas.length} fila(s)`}
          </button>
        </div>
      )}

      {resultado && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>
            ✔ {resultado.resumen.validas} válidas — ⚠ {resultado.resumen.conError} con error
          </h3>
          <table>
            <thead>
              <tr>
                <th>Legajo</th>
                <th>Categoría</th>
                <th>Concepto</th>
                <th>Estado</th>
                <th>Errores</th>
              </tr>
            </thead>
            <tbody>
              {resultado.filas.map((f: any, i: number) => (
                <tr key={i}>
                  <td>{f.legajoNumero}</td>
                  <td style={{ fontSize: "0.8rem", opacity: 0.7 }}>{categoriaDe(f.conceptoCodigo)}</td>
                  <td>{f.conceptoCodigo}</td>
                  <td>{f.estado === "valida" ? "✔ Válida" : "⚠ Con error"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{f.errores?.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!confirmado ? (
            <button onClick={confirmar} disabled={resultado.resumen.validas === 0} style={{ marginTop: "0.75rem" }}>
              Confirmar e importar {resultado.resumen.validas} novedades válidas
            </button>
          ) : (
            <p style={{ color: "#2F6F5E", fontWeight: "bold" }}>
              ✔ {confirmado.insertadas} novedades guardadas. Andá a{" "}
              <a href={`/liquidacion-masiva?periodoId=${periodoId}`}>/liquidacion-masiva</a> y liquidá de nuevo.
            </p>
          )}
        </div>
      )}

      {/* ── Eliminar novedades masivamente ── */}
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginTop: "1.5rem", maxWidth: "700px" }}>
        <h3 style={{ marginTop: 0, color: "#B23A3A" }}>Eliminar novedades</h3>
        <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
          Para volver a cargar desde cero, o corregir un error masivo — mismo filtro que ya conocés de /liquidacion-masiva.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
          <label>
            <input type="radio" checked={modoBorrado === "todos"} onChange={() => setModoBorrado("todos")} /> Todos
          </label>
          <label>
            <input type="radio" checked={modoBorrado === "convenio"} onChange={() => setModoBorrado("convenio")} /> Por convenio
          </label>
          <label>
            <input type="radio" checked={modoBorrado === "rango"} onChange={() => setModoBorrado("rango")} /> Por legajo (uno solo o rango)
          </label>
        </div>

        {modoBorrado === "convenio" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <select value={convenioIdBorrado} onChange={(e) => setConvenioIdBorrado(e.target.value)}>
              <option value="">Elegir convenio...</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
            </select>
          </div>
        )}
        {modoBorrado === "rango" && (
          <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="number" placeholder="Legajo desde" value={legajoDesdeBorrado} onChange={(e) => setLegajoDesdeBorrado(e.target.value)} style={{ width: "120px" }} />
            <span>hasta</span>
            <input type="number" placeholder="(igual al de arriba = uno solo)" value={legajoHastaBorrado} onChange={(e) => setLegajoHastaBorrado(e.target.value)} style={{ width: "220px" }} />
          </div>
        )}

        <div style={{ marginBottom: "0.75rem" }}>
          <select value={conceptoBorrado} onChange={(e) => setConceptoBorrado(e.target.value)}>
            <option value="">Todos los conceptos</option>
            {conceptos.map((c) => <option key={c.id} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
          </select>
        </div>

        <button
          onClick={eliminarNovedades}
          disabled={borrando || !periodoId}
          style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}
        >
          {borrando ? "Eliminando..." : "Eliminar novedades"}
        </button>
      </div>
    </main>
  );
}
