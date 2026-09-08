"use client";
import { useState, useEffect } from "react";

function money(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EscalasPage() {
  const [convenios, setConvenios] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [escalas, setEscalas] = useState<any[] | null>(null);

  const [vigenciaDesde, setVigenciaDesde] = useState("");
  const [basico, setBasico] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [basicoEditado, setBasicoEditado] = useState("");
  const [valorHoraEditado, setValorHoraEditado] = useState("");

  function empezarEdicion(e: any) {
    setEditandoId(e.id);
    setBasicoEditado(String(e.basico ?? ""));
    setValorHoraEditado(String(e.valorHora ?? ""));
  }

  async function guardarCorreccion(id: string) {
    const res = await fetch(`/api/escalas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ basico: basicoEditado, valorHora: valorHoraEditado }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "No se pudo corregir.");
      return;
    }
    setEditandoId(null);
    cargarEscalas();
  }

  useEffect(() => {
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
    const params = new URLSearchParams(window.location.search);
    const catId = params.get("categoriaId");
    if (catId) setCategoriaId(catId);
  }, []);

  useEffect(() => {
    if (!convenioId) { setCategorias([]); return; }
    fetch(`/api/categorias?convenioId=${convenioId}`).then((r) => r.json()).then(setCategorias);
  }, [convenioId]);

  useEffect(() => {
    if (!categoriaId) { setEscalas(null); return; }
    cargarEscalas();
    // Si llegamos con categoriaId por URL pero todavía no elegimos convenio, lo completamos.
    fetch(`/api/categorias`).then((r) => r.json()).then((todas) => {
      const cat = todas.find((c: any) => c.id === categoriaId);
      if (cat && !convenioId) setConvenioId(cat.convenioId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId]);

  async function cargarEscalas() {
    const res = await fetch(`/api/escalas?categoriaId=${categoriaId}`);
    setEscalas(await res.json());
  }

  async function guardar() {
    setError("");
    if (!vigenciaDesde) {
      setError("Completá la fecha de vigencia.");
      return;
    }
    setGuardando(true);
    const res = await fetch("/api/escalas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoriaId, vigenciaDesde, basico, valorHora }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setVigenciaDesde("");
    setBasico("");
    setValorHora("");
    cargarEscalas();
  }

  const categoriaActual = categorias.find((c) => c.id === categoriaId);
  const escalaVigenteHoy = escalas?.find((e) => new Date(e.vigenciaDesde) <= new Date());

  return (
    <main>
      <h1>Escalas salariales</h1>
      <p>
        El historial de básico/valor hora de cada categoría, y el lugar para cargar un aumento futuro — se agrega
        una fila nueva con la fecha en que empieza a regir, nunca se pisa la anterior (así se puede reliquidar un
        período viejo con el valor que tenía en ese momento).
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <select value={convenioId} onChange={(e) => { setConvenioId(e.target.value); setCategoriaId(""); }}>
          <option value="">Elegir convenio...</option>
          {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
        </select>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={!convenioId}>
          <option value="">Elegir categoría...</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {categoriaId && (
        <>
          <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "600px" }}>
            <h3 style={{ marginTop: 0 }}>Cargar un aumento futuro</h3>
            {escalaVigenteHoy && (
              <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                Vigente hoy: básico ${money(escalaVigenteHoy.basico)} — valor hora ${money(escalaVigenteHoy.valorHora)}
                {" "}(desde {new Date(escalaVigenteHoy.vigenciaDesde).toISOString().slice(0, 10)})
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: "0.8rem" }}>
                Vigente desde:{" "}
                <input type="date" value={vigenciaDesde} onChange={(e) => setVigenciaDesde(e.target.value)} />
              </label>
              <label style={{ fontSize: "0.8rem" }}>
                Básico: <input type="number" step="any" value={basico} onChange={(e) => setBasico(e.target.value)} style={{ width: "140px" }} />
              </label>
              <label style={{ fontSize: "0.8rem" }}>
                Valor hora: <input type="number" step="any" value={valorHora} onChange={(e) => setValorHora(e.target.value)} style={{ width: "140px" }} />
              </label>
              <button onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Cargar"}</button>
            </div>
            {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{error}</p>}
            <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.5rem" }}>
              Dejá el que no corresponda en 0 — un convenio mensual (como Comercio) solo usa "Básico"; uno por hora
              (como Madera) solo usa "Valor hora".
            </p>
          </div>

          <h3>Historial — {categoriaActual?.nombre}</h3>
          <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "-0.5rem" }}>
            "Corregir" edita ESTA fila para siempre — usalo solo para arreglar un error de tipeo. Para un aumento real, cargalo arriba como fila nueva.
          </p>
          <table>
            <thead>
              <tr>
                <th>Vigente desde</th>
                <th style={{ textAlign: "right" }}>Básico</th>
                <th style={{ textAlign: "right" }}>Valor hora</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {escalas?.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.vigenciaDesde).toISOString().slice(0, 10)}</td>
                  {editandoId === e.id ? (
                    <>
                      <td style={{ textAlign: "right" }}>
                        <input type="number" step="any" value={basicoEditado} onChange={(ev) => setBasicoEditado(ev.target.value)} style={{ width: "110px" }} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input type="number" step="any" value={valorHoraEditado} onChange={(ev) => setValorHoraEditado(ev.target.value)} style={{ width: "110px" }} />
                      </td>
                      <td>
                        <button onClick={() => guardarCorreccion(e.id)} style={{ fontSize: "0.75rem" }}>✔</button>
                        <button onClick={() => setEditandoId(null)} style={{ fontSize: "0.75rem", marginLeft: "0.2rem" }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: "right" }}>{e.basico ? `$${money(e.basico)}` : "—"}</td>
                      <td style={{ textAlign: "right" }}>{e.valorHora ? `$${money(e.valorHora)}` : "—"}</td>
                      <td>
                        <button onClick={() => empezarEdicion(e)} style={{ fontSize: "0.7rem", padding: "0.05rem 0.4rem" }}>Corregir</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {escalas?.length === 0 && (
                <tr><td colSpan={4} style={{ opacity: 0.6 }}>Sin escalas cargadas para esta categoría.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
