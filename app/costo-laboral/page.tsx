// FM RRHH — app/costo-laboral/page.tsx
// Costo laboral = bruto + contribuciones patronales reales, no solo el
// bruto — ver app/api/costo-laboral/route.ts. Un solo selector de rango
// cubre mensual/quincenal/anual: elegís el rango que quieras ver.
"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function money(v: number) {
  return "$ " + Math.round(v).toLocaleString("es-AR");
}
function fechaISO(d: Date) {
  return d.toISOString().substring(0, 10);
}

export default function CostoLaboralPage() {
  const hoy = new Date();
  const haceUnAnio = new Date(hoy);
  haceUnAnio.setUTCFullYear(haceUnAnio.getUTCFullYear() - 1);

  const [desde, setDesde] = useState(fechaISO(haceUnAnio));
  const [hasta, setHasta] = useState(fechaISO(hoy));
  const [convenios, setConvenios] = useState<any[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [categorias, setCategorias] = useState<any[]>([]);
  const [categoriaId, setCategoriaId] = useState("");

  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
    fetch("/api/categorias").then((r) => r.json()).then(setCategorias);
  }, []);

  useEffect(() => {
    if (!desde || !hasta) return;
    setCargando(true);
    const params = new URLSearchParams({ desde, hasta });
    if (convenioId) params.set("convenioId", convenioId);
    if (categoriaId) params.set("categoriaId", categoriaId);
    fetch(`/api/costo-laboral?${params}`)
      .then((r) => r.json())
      .then(setDatos)
      .catch(() => setDatos({ error: "El servidor no devolvió una respuesta válida." }))
      .finally(() => setCargando(false));
  }, [desde, hasta, convenioId, categoriaId]);

  function aplicarPreset(preset: "mes" | "trimestre" | "anio") {
    const h = new Date();
    const d = new Date(h);
    if (preset === "mes") d.setUTCMonth(d.getUTCMonth() - 1);
    if (preset === "trimestre") d.setUTCMonth(d.getUTCMonth() - 3);
    if (preset === "anio") d.setUTCFullYear(d.getUTCFullYear() - 1);
    setDesde(fechaISO(d));
    setHasta(fechaISO(h));
  }

  return (
    <main>
      <h1>Costo laboral</h1>
      <p style={{ opacity: 0.7, marginTop: "-0.5rem" }}>
        Bruto + contribuciones patronales reales (SIPA, obra social, ART, seguro de vida) — no solo el bruto. Un mismo selector de rango cubre mensual, quincenal o anual: elegí las fechas que necesites. Para estimar meses futuros, ver <a href="/costo-laboral/proyeccion">la proyección</a>.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label>Desde<br /><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta<br /><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button onClick={() => aplicarPreset("mes")} style={{ fontSize: "0.8rem" }}>Último mes</button>
          <button onClick={() => aplicarPreset("trimestre")} style={{ fontSize: "0.8rem" }}>Último trimestre</button>
          <button onClick={() => aplicarPreset("anio")} style={{ fontSize: "0.8rem" }}>Último año</button>
        </div>
        <label>Convenio<br />
          <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
            <option value="">Todos</option>
            {convenios.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>Categoría<br />
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      </div>

      {cargando && <p style={{ opacity: 0.6 }}>Calculando...</p>}
      {datos?.error && <p style={{ color: "var(--rojo)" }}>{datos.error}</p>}
      {datos?.sinDatos && <p style={{ opacity: 0.7, fontStyle: "italic" }}>No hay liquidaciones en este rango de fechas.</p>}

      {datos && !datos.sinDatos && !datos.error && (
        <>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <Tarjeta titulo="Costo laboral total (rango elegido)" valor={money(datos.totalCostoLaboral)} detalle={`${desde} a ${hasta}`} color="var(--azul-oscuro)" />
            <Tarjeta titulo="Masa salarial (bruto)" valor={money(datos.totalBruto)} detalle="" color="var(--verde)" />
            <Tarjeta titulo="Contribuciones patronales" valor={money(datos.totalContribuciones)} detalle="SIPA, OS, ART, seguro de vida" color="var(--ambar)" />
            <Tarjeta
              titulo={datos.proyeccionAnual.esReal ? "Costo anual (últimos 12 meses reales)" : "Proyección anual (estimada)"}
              valor={money(datos.proyeccionAnual.valor)}
              detalle={datos.proyeccionAnual.esReal ? "Suma real" : `Promedio mensual x 12 — solo ${datos.mesesConDatos} mes(es) con datos`}
              color={datos.proyeccionAnual.esReal ? "var(--verde)" : "var(--rojo)"}
            />
          </div>

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {datos.porMes.length > 1 && (
              <div>
                <h4 style={{ marginBottom: "0.5rem" }}>Evolución mensual</h4>
                <LineChart width={420} height={220} data={datos.porMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Line type="monotone" dataKey="total" stroke="#163A5C" strokeWidth={2} name="Costo total" />
                  <Line type="monotone" dataKey="bruto" stroke="#2F6F5E" strokeWidth={1.5} strokeDasharray="4 2" name="Bruto" />
                </LineChart>
              </div>
            )}

            {datos.porConvenio.length > 0 && (
              <div>
                <h4 style={{ marginBottom: "0.5rem" }}>Por convenio</h4>
                <BarChart width={340} height={Math.max(140, datos.porConvenio.length * 40)} data={datos.porConvenio} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="convenio" width={130} fontSize={11} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="total" fill="#B8752B" />
                </BarChart>
              </div>
            )}

            {datos.porCategoria.length > 0 && (
              <div>
                <h4 style={{ marginBottom: "0.5rem" }}>Por categoría</h4>
                <BarChart width={340} height={Math.max(140, datos.porCategoria.length * 32)} data={datos.porCategoria} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="categoria" width={150} fontSize={10} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="total" fill="#3C5A78" />
                </BarChart>
              </div>
            )}
          </div>

          {datos.porMes.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ marginBottom: "0.5rem" }}>Detalle mensual</h4>
              <table style={{ fontSize: "0.85rem", maxWidth: "480px" }}>
                <thead><tr><th>Mes</th><th>Bruto</th><th>Contribuciones</th><th>Total</th></tr></thead>
                <tbody>
                  {datos.porMes.map((m: any) => (
                    <tr key={m.mes}>
                      <td>{m.mes}</td>
                      <td style={{ textAlign: "right" }}>{money(m.bruto)}</td>
                      <td style={{ textAlign: "right" }}>{money(m.contribuciones)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{money(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Tarjeta({ titulo, valor, detalle, color }: { titulo: string; valor: string; detalle: string; color: string }) {
  return (
    <div style={{ background: "var(--gris-claro)", padding: "0.8rem 1.1rem", minWidth: "220px" }}>
      <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.7 }}>{titulo}</p>
      <p style={{ margin: "0.2rem 0", fontSize: "1.5rem", fontWeight: 700, color }}>{valor}</p>
      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.6 }}>{detalle}</p>
    </div>
  );
}
