"use client";
import { useState, useEffect, useRef } from "react";
import { PLANTILLAS } from "@/lib/plantillas-formula";

// FM RRHH — app/reglas/FormulaEditor.tsx
//
// Extraído de app/reglas/page.tsx (08/09/2026) para poder embeberlo tanto
// en /reglas como en /conceptos (rediseño pedido por Fernando: la creación
// de un concepto y su fórmula tienen que sentirse como una sola pantalla,
// no dos desconectadas — parecido a como Tango tiene todo en una ventana
// con pestañas).
//
// El panel de tokens insertables ahora está agrupado por "orígenes" — la
// idea que Fernando planteó: toda fórmula parte de datos que vienen de
// alguno de estos lugares:
//   - LEGAJO: datos fijos del empleado/período (antigüedad, días trabajados...)
//   - NOVEDADES CARGADAS: conceptos SIN fórmula propia — su valor llega
//     tal cual se cargó en /novedades ese mes (CANTIDAD() lee esa carga)
//   - TABLAS Y MATRICES: valores por categoría y topes/parámetros vigentes
//   - LIQUIDACIÓN (este período): totales que ya se calcularon en las
//     etapas anteriores de ESTA MISMA liquidación (remunerativo, no
//     remunerativo, neto — ver la nota sobre NETO() más abajo) y otros
//     conceptos ya resueltos vía CONCEPTO('CODIGO')
//
// NOVEDAD (antes no estaba expuesto como botón, aunque el motor ya lo
// soporta): NETO() — solo funciona en fórmulas de AJUSTE final (el motor
// detecta solo qué reglas lo usan y las corre al final de todo, después de
// calcular bruto y descuentos). Útil para conceptos que necesitan "% del
// neto", como un embargo — con la salvedad de que la prioridad ENTRE dos
// conceptos de ese tipo (ej. embargo judicial vs. comercial) sigue siendo
// algo que hay que diseñar con cuidado, no algo automático por usar NETO().
export interface ReglaExistente {
  id: string;
  concepto: { codigo: string; nombre: string };
  convenioId: string;
  formula: string;
  vigenciaDesde: string;
}

interface Props {
  conceptoCodigoInicial?: string;
  convenioIdInicial?: string;
  bloquearConcepto?: boolean; // true = el código de concepto viene fijo del padre (ej. embebido en /conceptos), no se puede tipear
  mostrarTablaReglas?: boolean; // default true
  mostrarBotonNueva?: boolean; // default true
  mostrarPlantillas?: boolean; // default true
  onGuardado?: () => void;
}

const OPERADORES = ["+", "-", "*", "/", "(", ")"];

// Mismo bloqueo que en app/api/reglas/route.ts (POST) — se repite acá para
// avisar ANTES de que el usuario intente guardar, no solo cuando falla.
const CODIGOS_SIN_FORMULA = ["SAC", "SAC_PROPORCIONAL", "RETENCION_GANANCIAS", "EMBARGO_JUDICIAL", "EMBARGO_COMERCIAL"];

export default function FormulaEditor({
  conceptoCodigoInicial = "",
  convenioIdInicial = "",
  bloquearConcepto = false,
  mostrarTablaReglas = true,
  mostrarBotonNueva = true,
  mostrarPlantillas = true,
  onGuardado,
}: Props) {
  const [convenios, setConvenios] = useState<any[]>([]);
  const [reglas, setReglas] = useState<any[]>([]);
  const [conceptoCodigo, setConceptoCodigo] = useState(conceptoCodigoInicial);
  const [convenioId, setConvenioId] = useState(convenioIdInicial);
  const [formula, setFormula] = useState("");
  const [vigenciaDesde, setVigenciaDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [resultado, setResultado] = useState<any>(null);
  const [guardado, setGuardado] = useState<any>(null);
  const [validando, setValidando] = useState(false);

  const [legajos, setLegajos] = useState<any[]>([]);
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [legajoPrueba, setLegajoPrueba] = useState("");
  const [periodoPrueba, setPeriodoPrueba] = useState("");
  const [prueba, setPrueba] = useState<any>(null);
  const [probando, setProbando] = useState(false);

  const [dependencias, setDependencias] = useState<any>(null);

  const [conceptosDisponibles, setConceptosDisponibles] = useState<any[]>([]);
  const [plantillaId, setPlantillaId] = useState("");
  const [valoresPlantilla, setValoresPlantilla] = useState<Record<string, string>>({});

  const [parametrosDisponibles, setParametrosDisponibles] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [reglasCargadas, setReglasCargadas] = useState(false);
  const [reglaVigenteEncontrada, setReglaVigenteEncontrada] = useState<any>(null);

  useEffect(() => {
    if (!conceptoCodigoInicial && !bloquearConcepto) {
      const params = new URLSearchParams(window.location.search);
      const cc = params.get("conceptoCodigo");
      const cv = params.get("convenioId");
      if (cc) setConceptoCodigo(cc);
      if (cv) setConvenioId(cv);
    }
    cargar();
    fetch("/api/legajos").then((r) => r.json()).then(setLegajos);
    fetch("/api/periodos").then((r) => r.json()).then((ps) => {
      setPeriodos(ps);
      setPeriodoPrueba(ps[0]?.id ?? "");
    });
    fetch("/api/conceptos").then((r) => r.json()).then((d) => setConceptosDisponibles(d.conceptos));
    fetch("/api/parametros").then((r) => r.json()).then(setParametrosDisponibles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar o limpiar el formulario cada vez que cambia A CUÁL fórmula
  // apunta el editor — nunca al tipear la fórmula en sí. Resuelve "no sé
  // si toco algo modifico una regla anterior o creo una nueva": el editor
  // SIEMPRE refleja la realidad actual de ese concepto+convenio.
  useEffect(() => {
    if (!reglasCargadas || !convenioId) return;
    const existente = reglas.find((r: any) => r.concepto.codigo === conceptoCodigo && r.convenioId === convenioId);
    setReglaVigenteEncontrada(existente ?? null);
    setFormula(existente ? existente.formula : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptoCodigo, convenioId, reglasCargadas]);

  function nuevaRegla() {
    setConceptoCodigo("");
    setConvenioId(convenios[0]?.id ?? "");
    setVigenciaDesde(new Date().toISOString().slice(0, 10));
    setGuardado(null);
  }

  async function probarConcepto() {
    if (!legajoPrueba || !periodoPrueba) {
      alert("Elegí un legajo y un período para probar.");
      return;
    }
    setProbando(true);
    const res = await fetch("/api/reglas/probar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legajoId: legajoPrueba, periodoId: periodoPrueba, conceptoCodigo, formula }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      data = { error: "El servidor no devolvió una respuesta válida." };
    }
    setPrueba({ ...data, ok: res.ok });
    setProbando(false);
  }

  const plantillaActual = PLANTILLAS.find((p) => p.id === plantillaId);

  function insertarEnCursor(token: string, cursorOffsetDesdeElFinal = 0) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormula((f) => f + token);
      return;
    }
    const inicio = textarea.selectionStart;
    const fin = textarea.selectionEnd;
    const nueva = formula.slice(0, inicio) + token + formula.slice(fin);
    setFormula(nueva);
    const nuevaPosicion = inicio + token.length - cursorOffsetDesdeElFinal;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nuevaPosicion, nuevaPosicion);
    });
  }

  function insertarPlantilla() {
    if (!plantillaActual) return;
    const faltantes = plantillaActual.campos.filter((c) => !valoresPlantilla[c.key]?.trim());
    if (faltantes.length > 0) {
      alert(`Completá: ${faltantes.map((c) => c.label).join(", ")}`);
      return;
    }
    setFormula(plantillaActual.generar(valoresPlantilla));
    setPlantillaId("");
    setValoresPlantilla({});
  }

  async function cargar() {
    const res = await fetch("/api/reglas");
    const data = await res.json();
    setReglas(data);
    const conveniosUnicos = Array.from(new Map(data.map((r: any) => [r.convenio.id, r.convenio])).values());
    setConvenios(conveniosUnicos);
    if (!convenioId && conveniosUnicos[0]) setConvenioId((conveniosUnicos[0] as any).id);
    setReglasCargadas(true);
  }

  async function validar() {
    if (!convenioId) return;
    setValidando(true);
    setGuardado(null);
    const res = await fetch("/api/reglas/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conceptoCodigo, convenioId, formula }),
    });
    setResultado(await res.json());
    setValidando(false);
  }

  async function cargarDependencias() {
    if (!convenioId || !conceptoCodigo || !formula) return;
    const params = new URLSearchParams({ conceptoCodigo, convenioId, formula });
    const res = await fetch(`/api/reglas/dependencias?${params}`);
    if (res.ok) setDependencias(await res.json());
  }

  useEffect(() => {
    if (convenioId) {
      validar();
      cargarDependencias();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptoCodigo, convenioId, formula]);

  async function eliminarReglaActual() {
    if (!reglaVigenteEncontrada) return;
    if (!confirm(`¿Eliminar la fórmula de "${conceptoCodigo}" para este convenio? No se puede deshacer.`)) return;
    const res = await fetch(`/api/reglas/${reglaVigenteEncontrada.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setFormula("");
    cargar();
    onGuardado?.();
  }

  async function guardar() {
    const res = await fetch("/api/reglas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conceptoCodigo, convenioId, formula, aporta: true, contribuye: true, vigenciaDesde }),
    });
    const data = await res.json();
    setGuardado(data);
    if (res.ok) {
      cargar();
      onGuardado?.();
    }
  }

  // ── Los "orígenes" para agrupar el panel de tokens ──
  const codigosConReglaEnEsteConvenio = new Set(reglas.filter((r) => r.convenioId === convenioId).map((r) => r.concepto.codigo));
  const novedadesCargadas = conceptosDisponibles.filter((c) => !codigosConReglaEnEsteConvenio.has(c.codigo));
  const otrosConceptosCalculados = conceptosDisponibles.filter((c) => codigosConReglaEnEsteConvenio.has(c.codigo) && c.codigo !== conceptoCodigo);

  return (
    <div>
      <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 0 }}>
        La validación corre sola mientras escribís — sintaxis, ciclos, y referencias a conceptos/topes inexistentes.
      </p>

      {mostrarPlantillas && (
        <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "700px" }}>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Fórmulas habituales</h3>
          <select value={plantillaId} onChange={(e) => { setPlantillaId(e.target.value); setValoresPlantilla({}); }} style={{ width: "100%", marginBottom: "0.5rem" }}>
            <option value="">Elegir una fórmula prearmada...</option>
            {PLANTILLAS.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          {plantillaActual && (
            <div style={{ background: "#EEF1F4", padding: "0.75rem" }}>
              <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0 0 0.4rem" }}>{plantillaActual.descripcion}</p>
              <p style={{ fontFamily: "monospace", fontSize: "0.8rem", margin: "0 0 0.6rem" }}>{plantillaActual.patron}</p>
              {plantillaActual.campos.map((c) => (
                <div key={c.key} style={{ marginBottom: "0.4rem" }}>
                  <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.15rem" }}>{c.label}</label>
                  {c.tipo === "concepto" ? (
                    <select value={valoresPlantilla[c.key] ?? ""} onChange={(e) => setValoresPlantilla({ ...valoresPlantilla, [c.key]: e.target.value })} style={{ width: "100%" }}>
                      <option value="">Elegir concepto...</option>
                      {conceptosDisponibles.map((co) => <option key={co.id} value={co.codigo}>{co.codigo} — {co.nombre}</option>)}
                    </select>
                  ) : (
                    <input
                      type={c.tipo === "numero" ? "number" : "text"}
                      step="any"
                      placeholder={c.placeholder}
                      value={valoresPlantilla[c.key] ?? ""}
                      onChange={(e) => setValoresPlantilla({ ...valoresPlantilla, [c.key]: e.target.value })}
                      style={{ width: "100%" }}
                    />
                  )}
                </div>
              ))}
              <button onClick={insertarPlantilla} style={{ marginTop: "0.4rem" }}>Insertar en el editor →</button>
            </div>
          )}
        </div>
      )}

      {mostrarBotonNueva && (
        <div style={{ marginBottom: "0.5rem" }}>
          <button onClick={nuevaRegla} style={{ fontWeight: "bold" }}>+ Nueva regla</button>
        </div>
      )}

      <div style={{ marginBottom: "0.5rem" }}>
        {!bloquearConcepto && (
          <input
            value={conceptoCodigo}
            onChange={(e) => setConceptoCodigo(e.target.value.toUpperCase())}
            placeholder="Código de concepto"
            style={{ marginRight: "0.5rem" }}
          />
        )}
        <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)} style={{ marginRight: "0.5rem" }}>
          {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
        </select>
        <label style={{ fontSize: "0.85rem" }}>
          Vigencia desde: <input type="date" value={vigenciaDesde} onChange={(e) => setVigenciaDesde(e.target.value)} />
        </label>
      </div>

      {CODIGOS_SIN_FORMULA.includes(conceptoCodigo) && (
        <p style={{ fontSize: "0.85rem", margin: "0 0 1rem", padding: "0.5rem 0.75rem", background: "#fdf2ea", border: "1px solid #B8752B", maxWidth: "600px" }}>
          ⚠ "{conceptoCodigo}" se calcula con código dedicado (lee tablas propias, maneja prioridad y topes entre
          conceptos) — no puede tener una fórmula acá. No se va a poder guardar.
        </p>
      )}

      {reglasCargadas && conceptoCodigo && convenioId && (
        <p style={{ fontSize: "0.85rem", margin: "0 0 1rem", padding: "0.4rem 0.6rem", background: reglaVigenteEncontrada ? "#EEF1F4" : "#eaf5ef", border: `1px solid ${reglaVigenteEncontrada ? "#163A5C" : "#2F6F5E"}`, display: "inline-block" }}>
          {reglaVigenteEncontrada
            ? `✏️ Editando la fórmula vigente de "${conceptoCodigo}" para este convenio (desde ${new Date(reglaVigenteEncontrada.vigenciaDesde).toLocaleDateString("es-AR")}). Guardar acá cierra esa versión y crea una nueva — no se pisa, queda en el historial.`
            : `🆕 No hay ninguna fórmula todavía para "${conceptoCodigo}" en este convenio — vas a crear una nueva.`}
        </p>
      )}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <textarea
          ref={textareaRef}
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          rows={6}
          style={{ flex: "1 1 400px", maxWidth: "600px", padding: "0.5rem", fontFamily: "monospace" }}
        />

        <div style={{ flex: "0 0 300px", background: "white", border: "1px solid #dfe4e8", padding: "0.75rem", maxHeight: "320px", overflowY: "auto" }}>
          <p style={{ fontSize: "0.75rem", opacity: 0.6, margin: "0 0 0.5rem" }}>
            De dónde puede venir un dato — insertar donde esté el cursor:
          </p>

          <details open style={{ marginBottom: "0.5rem" }}>
            <summary style={{ fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>LEGAJO</summary>
            {[
              { token: "BASICO", label: "Básico" },
              { token: "VALOR_HORA", label: "Valor hora" },
              { token: "ANTIGUEDAD_ANIOS", label: "Antigüedad (años)" },
              { token: "DIAS_TRABAJADOS", label: "Días trabajados" },
              { token: "DIAS_MES", label: "Días del período" },
              { token: "HORAS_TRABAJADAS", label: "Horas trabajadas" },
            ].map((v) => (
              <button key={v.token} onClick={() => insertarEnCursor(v.token)} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
                {v.label}
              </button>
            ))}
          </details>

          <details style={{ marginBottom: "0.5rem" }}>
            <summary style={{ fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>NOVEDADES CARGADAS</summary>
            <button onClick={() => insertarEnCursor("CANTIDAD()")} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
              Cantidad cargada por novedad de ESTE concepto
            </button>
            {novedadesCargadas.map((c) => (
              <button key={c.id} onClick={() => insertarEnCursor(`CONCEPTO('${c.codigo}')`)} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
                {c.codigo} — {c.nombre} <span style={{ opacity: 0.5 }}>(sin fórmula, insumo)</span>
              </button>
            ))}
          </details>

          <details style={{ marginBottom: "0.5rem" }}>
            <summary style={{ fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>TABLAS Y MATRICES</summary>
            <button onClick={() => insertarEnCursor("VALOR_CATEGORIA('')", 2)} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
              Valor por categoría — VALOR_CATEGORIA('código')
            </button>
            {[...new Map(parametrosDisponibles.map((p) => [p.clave, p])).values()].map((p) => (
              <button key={p.clave} onClick={() => insertarEnCursor(`TOPE('${p.clave}')`)} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
                TOPE('{p.clave}')
              </button>
            ))}
            {parametrosDisponibles.length === 0 && <p style={{ fontSize: "0.7rem", opacity: 0.5 }}>No hay parámetros cargados en /parametros todavía.</p>}
          </details>

          <details style={{ marginBottom: "0.5rem" }}>
            <summary style={{ fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>LIQUIDACIÓN (este período)</summary>
            <button onClick={() => insertarEnCursor("REM_TOTAL()")} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
              Total remunerativo — REM_TOTAL()
            </button>
            <button onClick={() => insertarEnCursor("NOREM_TOTAL()")} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
              Total no remunerativo — NOREM_TOTAL()
            </button>
            <button onClick={() => insertarEnCursor("NETO()")} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }} title="Solo funciona en conceptos de ajuste final (ej. un descuento sobre el neto) — el motor lo detecta solo y calcula esta fórmula al final de todo">
              Neto hasta acá — NETO() ⚠ solo ajustes finales
            </button>
            {otrosConceptosCalculados.map((c) => (
              <button key={c.id} onClick={() => insertarEnCursor(`CONCEPTO('${c.codigo}')`)} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
                {c.codigo} — {c.nombre}
              </button>
            ))}
          </details>

          <details style={{ marginBottom: "0.5rem" }}>
            <summary style={{ fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>FUNCIONES</summary>
            {[
              { token: "MIN(, )", label: "Mínimo — MIN(a, b)", cursorOffset: 3 },
              { token: "MAX(, )", label: "Máximo — MAX(a, b)", cursorOffset: 3 },
              { token: "ROUND(, 2)", label: "Redondear — ROUND(valor, decimales)", cursorOffset: 4 },
              { token: "IF(, , )", label: "Condición — IF(condición, si_true, si_false)", cursorOffset: 5 },
            ].map((f) => (
              <button key={f.token} onClick={() => insertarEnCursor(f.token, f.cursorOffset ?? 0)} style={{ display: "block", width: "100%", textAlign: "left", fontSize: "0.75rem", margin: "0.15rem 0", background: "white", color: "#163A5C", border: "1px solid #dfe4e8" }}>
                {f.label}
              </button>
            ))}
          </details>

          <details>
            <summary style={{ fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer" }}>OPERADORES</summary>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {OPERADORES.map((op) => (
                <button key={op} onClick={() => insertarEnCursor(op)} style={{ fontFamily: "monospace", width: "32px" }}>{op}</button>
              ))}
            </div>
          </details>
        </div>
      </div>

      {resultado && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "white", border: `2px solid ${resultado.ok ? "#2F6F5E" : "#B23A3A"}`, maxWidth: "600px" }}>
          {resultado.errores?.map((e: any, i: number) => <div key={i} style={{ color: "#B23A3A" }}>✕ {e.mensaje}</div>)}
          {resultado.advertencias?.map((a: any, i: number) => <div key={i} style={{ color: "#B8752B" }}>⚠ {a.mensaje}</div>)}
          {resultado.ok && <div style={{ color: "#2F6F5E" }}>✔ Válida — orden de evaluación: {resultado.ordenResultante?.join(" → ")}</div>}
        </div>
      )}

      {dependencias && (
        <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", maxWidth: "700px" }}>
          <div style={{ flex: 1, minWidth: "260px", background: "white", border: "1px solid #dfe4e8", padding: "0.75rem" }}>
            <strong style={{ fontSize: "0.85rem" }}>DEPENDE DE</strong>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
              {dependencias.dependeDe.map((d: any) => <li key={d.codigo}>✓ {d.codigo} <span style={{ opacity: 0.6 }}>({d.nombre})</span></li>)}
              {dependencias.variablesBase.map((v: string) => <li key={v} style={{ opacity: 0.7 }}>· {v}</li>)}
              {dependencias.topes.map((t: string) => <li key={t} style={{ opacity: 0.7 }}>· TOPE({t})</li>)}
              {dependencias.funciones.map((f: string) => <li key={f} style={{ opacity: 0.5 }}>ƒ {f}()</li>)}
              {dependencias.dependeDe.length === 0 && dependencias.variablesBase.length === 0 && dependencias.topes.length === 0 && <li style={{ opacity: 0.5 }}>Nada — es un valor fijo o solo usa números.</li>}
            </ul>
          </div>
          <div style={{ flex: 1, minWidth: "260px", background: "white", border: "1px solid #dfe4e8", padding: "0.75rem" }}>
            <strong style={{ fontSize: "0.85rem" }}>ES UTILIZADO POR</strong>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
              {dependencias.esUtilizadoPor.map((u: any) => <li key={u.codigo}>→ {u.codigo} <span style={{ opacity: 0.6 }}>({u.nombre})</span></li>)}
              {dependencias.afecta && <li>→ {dependencias.afecta}</li>}
              {dependencias.esUtilizadoPor.length === 0 && !dependencias.afecta && <li style={{ opacity: 0.5 }}>Nada todavía referencia este concepto.</li>}
            </ul>
            <p style={{ fontSize: "0.7rem", opacity: 0.5, margin: "0.5rem 0 0" }}>Si modificás esta fórmula, revisá los conceptos de arriba — su cálculo puede cambiar.</p>
          </div>
        </div>
      )}

      <div style={{ marginTop: "1.5rem", background: "#EEF1F4", border: "1px solid #dfe4e8", padding: "1rem", maxWidth: "700px" }}>
        <h3 style={{ marginTop: 0 }}>Probar concepto</h3>
        <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 0 }}>
          Corre esta fórmula de verdad, contra un legajo y período reales — sin guardar nada.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <select value={legajoPrueba} onChange={(e) => setLegajoPrueba(e.target.value)}>
            <option value="">Legajo de prueba...</option>
            {legajos.map((l) => <option key={l.id} value={l.id}>{l.numero} — {l.apellido}, {l.nombre}</option>)}
          </select>
          <select value={periodoPrueba} onChange={(e) => setPeriodoPrueba(e.target.value)}>
            {periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <button onClick={probarConcepto} disabled={probando}>{probando ? "Probando..." : "Probar"}</button>
        </div>

        {prueba && (
          <div style={{ background: "white", border: `2px solid ${prueba.ok ? "#2F6F5E" : "#B23A3A"}`, padding: "0.75rem" }}>
            {!prueba.ok ? (
              <p style={{ color: "#B23A3A", margin: 0 }}>{prueba.error}</p>
            ) : (
              <>
                <p style={{ margin: "0 0 0.5rem" }}>
                  <strong>{prueba.legajo.numero} — {prueba.legajo.apellido}, {prueba.legajo.nombre}</strong> ({prueba.legajo.convenio} — {prueba.legajo.categoria})
                </p>
                <p style={{ fontSize: "1.3rem", margin: "0 0 0.5rem" }}>
                  <strong>{conceptoCodigo}</strong> = ${prueba.importe?.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </p>
                {prueba.traza && <p style={{ fontFamily: "monospace", fontSize: "0.8rem", background: "#f5f5f5", padding: "0.5rem", overflowX: "auto" }}>{prueba.traza}</p>}
                <details style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  <summary style={{ cursor: "pointer", opacity: 0.7 }}>Ver la liquidación completa de este legajo con esta fórmula</summary>
                  <table style={{ marginTop: "0.5rem" }}>
                    <tbody>
                      {prueba.detalleCompleto.map((d: any) => (
                        <tr key={d.concepto} style={{ fontWeight: d.concepto === conceptoCodigo ? "bold" : "normal" }}>
                          <td>{d.nombre}</td>
                          <td style={{ textAlign: "right" }}>${d.importe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "1px solid #ccc" }}><td>Bruto</td><td style={{ textAlign: "right" }}>${prueba.bruto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td></tr>
                      <tr><td>Neto</td><td style={{ textAlign: "right" }}>${prueba.neto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td></tr>
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </div>
        )}
      </div>

      <button onClick={guardar} disabled={!resultado?.ok || validando || CODIGOS_SIN_FORMULA.includes(conceptoCodigo)} style={{ marginTop: "1rem" }}>Guardar regla</button>
      {reglaVigenteEncontrada && (
        <button onClick={eliminarReglaActual} style={{ marginTop: "1rem", marginLeft: "0.5rem", background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}>
          Eliminar esta regla
        </button>
      )}
      {guardado && (
        <p style={{ color: guardado.ok ? "#2F6F5E" : "#B23A3A" }}>
          {guardado.ok ? "✔ Guardada en la base." : `✕ ${guardado.error}: ${guardado.detalle?.map((d: any) => d.mensaje).join("; ")}`}
        </p>
      )}

      {mostrarTablaReglas && (
        <>
          <h3 style={{ marginTop: "2rem" }}>Reglas vigentes</h3>
          <table>
            <thead><tr><th>Concepto</th><th>Convenio</th><th>Fórmula</th></tr></thead>
            <tbody>
              {reglas.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => {
                    setConceptoCodigo(r.concepto.codigo);
                    setConvenioId(r.convenioId);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  style={{ cursor: "pointer" }}
                  title="Click para editar esta fórmula"
                >
                  <td>{r.concepto.codigo}</td>
                  <td>{r.convenio.codigo}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{r.formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
