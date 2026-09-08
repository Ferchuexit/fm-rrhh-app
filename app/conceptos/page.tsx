"use client";
import { useState, useEffect, Fragment } from "react";
import FormulaEditor from "@/app/reglas/FormulaEditor";

const TIPO_LABEL: Record<string, string> = {
  remunerativo: "Remunerativo",
  no_remunerativo: "No remunerativo",
  descuento: "Descuento / Base imponible",
};

const CATEGORIAS_NOVEDAD = ["Básicos y Fijos", "Horas", "Licencias y Ausencias", "Préstamos y Adelantos", "Premios y Comisiones", "Otros"];

export default function ConceptosPage() {
  const [conceptos, setConceptos] = useState<any[]>([]);
  const [rangos, setRangos] = useState<any[]>([]);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [numeroManual, setNumeroManual] = useState("");
  const [tipo, setTipo] = useState("remunerativo");
  const [unidad, setUnidad] = useState("monto");
  const [categoriaNovedad, setCategoriaNovedad] = useState("Otros");
  const [error, setError] = useState("");
  const [numeroEditando, setNumeroEditando] = useState<Record<string, string>>({});
  const [nombreEditando, setNombreEditando] = useState<Record<string, string>>({});
  const [formulaAbiertaPara, setFormulaAbiertaPara] = useState<string | null>(null);

  // ── Vincular una fórmula en el mismo momento de crear el concepto ──
  // (antes había que crear el concepto acá y después ir a /reglas aparte)
  const [conCFormula, setConFormula] = useState(false);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [convenioIdNueva, setConvenioIdNueva] = useState("");
  const [formulaNueva, setFormulaNueva] = useState("");
  const [vigenciaDesdeNueva, setVigenciaDesdeNueva] = useState(() => new Date().toISOString().slice(0, 10));

  async function guardarCategoria(id: string, valor: string) {
    await fetch(`/api/conceptos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoriaNovedad: valor }),
    });
    cargar();
  }

  async function guardarNombre(id: string) {
    const nuevoNombre = nombreEditando[id];
    if (!nuevoNombre || !nuevoNombre.trim()) return;
    const res = await fetch(`/api/conceptos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoNombre }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    const copia = { ...nombreEditando };
    delete copia[id];
    setNombreEditando(copia);
    cargar();
  }

  async function asignarNumero(id: string) {
    const numero = numeroEditando[id];
    if (!numero) return;
    const res = await fetch(`/api/conceptos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setNumeroEditando({ ...numeroEditando, [id]: "" });
    cargar();
  }

  async function eliminarConcepto(id: string, codigo: string) {
    if (!confirm(`¿Eliminar el concepto "${codigo}"? Esto no se puede deshacer.`)) return;
    const res = await fetch(`/api/conceptos/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      cargar();
      return;
    }

    if (data.puedeForzar) {
      const { reglas, liquidaciones, novedades } = data.detalleUso;
      const detalle = [
        reglas > 0 && `${reglas} regla(s) de fórmula`,
        liquidaciones > 0 && `${liquidaciones} liquidación(es) COMPLETA(S) (no solo la línea de este concepto — el bruto/neto quedaría inconsistente si se borrara solo eso)`,
        novedades > 0 && `${novedades} novedad(es) cargada(s)`,
      ].filter(Boolean).join(", ");

      if (!confirm(`"${codigo}" está en uso: ${detalle}.\n\n¿Eliminar TODO eso y el concepto? Las liquidaciones afectadas van a desaparecer — habría que volver a correrlas desde /liquidar después.`)) {
        return;
      }
      const res2 = await fetch(`/api/conceptos/${id}?forzar=true`, { method: "DELETE" });
      const data2 = await res2.json();
      if (!res2.ok) {
        alert(data2.error);
        return;
      }
      if (data2.liquidacionesEliminadas > 0) {
        alert(`Listo. Se eliminaron ${data2.liquidacionesEliminadas} liquidación(es) junto con el concepto.`);
      }
      cargar();
      return;
    }

    if (data.formulasQueLoMencionan) {
      alert(`${data.error}\n\n${data.formulasQueLoMencionan.join("\n")}\n\n${data.solucion}`);
      return;
    }

    alert(data.error);
  }

  async function cargar() {
    const res = await fetch("/api/conceptos");
    const data = await res.json();
    setConceptos(data.conceptos);
    setRangos(data.rangos);
  }

  useEffect(() => {
    cargar();
    fetch("/api/convenios").then((r) => r.json()).then((cs) => {
      setConvenios(cs);
      setConvenioIdNueva((prev) => prev || cs[0]?.id || "");
    });
  }, []);

  async function guardarRango(t: string, desde: number, hasta: number) {
    await fetch("/api/rangos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: t, desde, hasta }),
    });
    cargar();
  }

  async function agregarConcepto() {
    setError("");
    if (conCFormula && !formulaNueva.trim()) {
      setError("Marcaste \"vincular una fórmula\" pero no escribiste ninguna.");
      return;
    }
    const res = await fetch("/api/conceptos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, nombre, tipo, unidad, categoriaNovedad, numero: numeroManual ? Number(numeroManual) : undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }

    if (conCFormula) {
      const resRegla = await fetch("/api/reglas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptoCodigo: data.codigo,
          convenioId: convenioIdNueva,
          formula: formulaNueva,
          aporta: true,
          contribuye: true,
          vigenciaDesde: vigenciaDesdeNueva,
        }),
      });
      const dataRegla = await resRegla.json();
      if (!resRegla.ok) {
        // El concepto SÍ se creó — avisar claramente que falta la fórmula,
        // en vez de dejar la duda de si se creó algo a medias en silencio.
        setError(
          `El concepto "${data.codigo}" se creó, pero la fórmula no se pudo guardar: ${dataRegla.error}${dataRegla.detalle ? " — " + dataRegla.detalle.map((d: any) => d.mensaje).join("; ") : ""}. Podés cargarla después desplegando "Fórmula" en la tabla de abajo.`
        );
        setCodigo("");
        setNombre("");
        setNumeroManual("");
        setFormulaNueva("");
        cargar();
        return;
      }
    }

    setCodigo("");
    setNombre("");
    setNumeroManual("");
    setFormulaNueva("");
    setConFormula(false);
    cargar();
  }

  const rangoDe = (t: string) => rangos.find((r) => r.tipo === t);

  return (
    <main>
      <h1>Catálogo de conceptos</h1>
      <p>
        Numeración por rango — configurable, no fijo en el código. Crear un concepto y su fórmula ahora es un solo
        flujo: marcá "vincular una fórmula" al crear, o desplegá "Fórmula" en cualquier fila de la tabla para
        editarla ahí mismo, sin salir de esta pantalla.
      </p>

      <h3>Rangos por tipo</h3>
      {Object.entries(TIPO_LABEL).map(([t, label]) => {
        const r = rangoDe(t);
        return (
          <div key={t} style={{ marginBottom: "0.5rem" }}>
            <span style={{ display: "inline-block", width: "220px" }}>{label}</span>
            <input
              type="number"
              defaultValue={r?.desde ?? ""}
              id={`desde-${t}`}
              style={{ width: "80px", marginRight: "0.3rem" }}
              placeholder="desde"
            />
            a
            <input
              type="number"
              defaultValue={r?.hasta ?? ""}
              id={`hasta-${t}`}
              style={{ width: "80px", margin: "0 0.5rem" }}
              placeholder="hasta"
            />
            <button
              onClick={() => {
                const desde = Number((document.getElementById(`desde-${t}`) as HTMLInputElement).value);
                const hasta = Number((document.getElementById(`hasta-${t}`) as HTMLInputElement).value);
                guardarRango(t, desde, hasta);
              }}
            >
              Guardar rango
            </button>
          </div>
        );
      })}

      <h3 style={{ marginTop: "2rem" }}>Nuevo concepto</h3>
      <input placeholder="Código (ej. PLUS_NOCTURNO)" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ marginRight: "0.5rem" }} />
      <input
        placeholder="N° (vacío = sugerido)"
        type="number"
        value={numeroManual}
        onChange={(e) => setNumeroManual(e.target.value)}
        style={{ marginRight: "0.5rem", width: "150px" }}
      />
      <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ marginRight: "0.5rem" }} />
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ marginRight: "0.5rem" }}>
        {Object.entries(TIPO_LABEL).map(([t, l]) => (
          <option key={t} value={t}>{l}</option>
        ))}
      </select>
      <select value={unidad} onChange={(e) => setUnidad(e.target.value)} style={{ marginRight: "0.5rem" }}>
        <option value="monto">monto</option>
        <option value="horas">horas</option>
        <option value="porcentaje">porcentaje</option>
      </select>
      <select value={categoriaNovedad} onChange={(e) => setCategoriaNovedad(e.target.value)} style={{ marginRight: "0.5rem" }}>
        {CATEGORIAS_NOVEDAD.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button onClick={agregarConcepto}>Agregar</button>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}

      <div style={{ marginTop: "0.75rem" }}>
        <label style={{ fontSize: "0.85rem" }}>
          <input type="checkbox" checked={conCFormula} onChange={(e) => setConFormula(e.target.checked)} style={{ marginRight: "0.4rem" }} />
          Vincular una fórmula ahora (si no, queda como insumo sin fórmula — se puede agregar después desde "Editar fórmula")
        </label>
      </div>

      {conCFormula && (
        <div style={{ background: "#EEF1F4", border: "1px solid #dfe4e8", padding: "0.75rem", marginTop: "0.5rem", maxWidth: "700px" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <select value={convenioIdNueva} onChange={(e) => setConvenioIdNueva(e.target.value)}>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
            </select>
            <label style={{ fontSize: "0.85rem" }}>
              Vigencia desde: <input type="date" value={vigenciaDesdeNueva} onChange={(e) => setVigenciaDesdeNueva(e.target.value)} />
            </label>
          </div>
          <textarea
            value={formulaNueva}
            onChange={(e) => setFormulaNueva(e.target.value)}
            placeholder="Ej: CONCEPTO('REM_BASICA') * 0.05"
            rows={3}
            style={{ width: "100%", fontFamily: "monospace", padding: "0.5rem" }}
          />
          <p style={{ fontSize: "0.75rem", opacity: 0.6, margin: "0.4rem 0 0" }}>
            Editor simple — sin autocompletado de tokens ni "probar contra un legajo real". Para eso, una vez creado
            desplegá "Fórmula" en la tabla de abajo, que abre el editor completo ahí mismo.
          </p>
        </div>
      )}

      <h3 style={{ marginTop: "2rem" }}>Conceptos cargados</h3>
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Código</th>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Categoría (novedades)</th>
            <th>Fórmula</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {conceptos.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td>
                  {c.numero ?? (
                    <span>
                      <input
                        type="number"
                        value={numeroEditando[c.id] ?? ""}
                        onChange={(e) => setNumeroEditando({ ...numeroEditando, [c.id]: e.target.value })}
                        placeholder="asignar"
                        style={{ width: "70px" }}
                      />
                      <button onClick={() => asignarNumero(c.id)} style={{ marginLeft: "0.3rem" }}>OK</button>
                    </span>
                  )}
                </td>
                <td>{c.codigo}</td>
                <td>
                  {nombreEditando[c.id] !== undefined ? (
                    <span>
                      <input
                        value={nombreEditando[c.id]}
                        onChange={(e) => setNombreEditando({ ...nombreEditando, [c.id]: e.target.value })}
                        style={{ width: "160px" }}
                      />
                      <button onClick={() => guardarNombre(c.id)} style={{ marginLeft: "0.3rem" }}>OK</button>
                    </span>
                  ) : (
                    <span>
                      {c.nombre}{" "}
                      <button
                        onClick={() => setNombreEditando({ ...nombreEditando, [c.id]: c.nombre })}
                        style={{ background: "white", color: "#163A5C", border: "1px solid #163A5C", padding: "0.1rem 0.5rem", fontSize: "0.75rem" }}
                      >
                        Editar
                      </button>
                    </span>
                  )}
                </td>
                <td>{TIPO_LABEL[c.tipo] ?? c.tipo}</td>
                <td>
                  <select value={c.categoriaNovedad ?? "Otros"} onChange={(e) => guardarCategoria(c.id, e.target.value)} style={{ fontSize: "0.8rem" }}>
                    {CATEGORIAS_NOVEDAD.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => setFormulaAbiertaPara(formulaAbiertaPara === c.id ? null : c.id)}
                    style={{ fontSize: "0.8rem", background: "white", color: "#163A5C", border: "1px solid #163A5C" }}
                  >
                    {c.reglas?.length > 0 ? `Fórmula (${c.reglas.length})` : "Sin fórmula"} {formulaAbiertaPara === c.id ? "▾" : "▸"}
                  </button>
                </td>
                <td>
                  <button onClick={() => eliminarConcepto(c.id, c.codigo)} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}>
                    Eliminar
                  </button>
                </td>
              </tr>
              {formulaAbiertaPara === c.id && (
                <tr>
                  <td colSpan={7} style={{ background: "#fafbfc", padding: "1rem", borderBottom: "2px solid #dfe4e8" }}>
                    <FormulaEditor
                      key={c.id}
                      conceptoCodigoInicial={c.codigo}
                      convenioIdInicial={c.reglas?.[0]?.convenioId ?? ""}
                      bloquearConcepto
                      mostrarTablaReglas={false}
                      mostrarBotonNueva={false}
                      mostrarPlantillas={false}
                      onGuardado={cargar}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </main>
  );
}
