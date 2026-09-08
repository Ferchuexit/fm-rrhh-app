// FM RRHH — app/costo-laboral/proyeccion/page.tsx
"use client";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function money(v: number) {
  return "$ " + Math.round(v).toLocaleString("es-AR");
}

export default function ProyeccionCostoLaboralPage() {
  const hoy = new Date();
  const en12Meses = new Date(hoy);
  en12Meses.setUTCMonth(en12Meses.getUTCMonth() + 12);
  const mesDefault = en12Meses.toISOString().substring(0, 7);

  const [hastaMes, setHastaMes] = useState(mesDefault);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [modo, setModo] = useState<"historico" | "manual">("historico");
  const [porcentajeManual, setPorcentajeManual] = useState("3");

  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
  }, []);

  useEffect(() => {
    if (!hastaMes) return;
    setCargando(true);
    const params = new URLSearchParams({ hastaMes, modo });
    if (convenioId) params.set("convenioId", convenioId);
    if (modo === "manual") params.set("porcentajeManual", porcentajeManual);
    fetch(`/api/proyeccion-costo-laboral?${params}`)
      .then((r) => r.json())
      .then(setDatos)
      .catch(() => setDatos({ error: "El servidor no devolvió una respuesta válida." }))
      .finally(() => setCargando(false));
  }, [hastaMes, convenioId, modo, porcentajeManual]);

  return (
    <main>
      <h1>Proyección de costo laboral</h1>
      <p style={{ opacity: 0.7, marginTop: "-0.5rem" }}>
        Estimación mes a mes desde el último período liquidado. NO es un número garantizado — es una proyección basada en el método que elijas abajo. Ver <a href="/costo-laboral">/costo-laboral</a> para los datos reales ya liquidados.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label>Proyectar hasta<br /><input type="month" value={hastaMes} onChange={(e) => setHastaMes(e.target.value)} /></label>
        <label>Convenio<br />
          <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
            <option value="">Todos</option>
            {convenios.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>Método<br />
          <select value={modo} onChange={(e) => setModo(e.target.value as any)}>
            <option value="historico">Histórico (automático, desde Escala)</option>
            <option value="manual">Porcentaje manual</option>
          </select>
        </label>
        {modo === "manual" && (
          <label>% mensual<br />
            <input type="number" step="0.1" value={porcentajeManual} onChange={(e) => setPorcentajeManual(e.target.value)} style={{ width: "80px" }} />
          </label>
        )}
      </div>

      {cargando && <p style={{ opacity: 0.6 }}>Calculando...</p>}
      {datos?.error && <p style={{ color: "var(--rojo)" }}>{datos.error}</p>}

      {datos && !datos.error && (
        <>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <Tarjeta titulo="Base (último mes real)" valor={money(datos.costoBase)} detalle={datos.mesBase} color="var(--verde)" />
            <Tarjeta titulo="Tasa mensual aplicada" valor={`${datos.tasaMensual.toFixed(2)}%`} detalle={modo === "historico" ? "calculada" : "manual"} color="var(--azul-oscuro)" />
            <Tarjeta titulo={`Proyectado a ${hastaMes}`} valor={money(datos.serie[datos.serie.length - 1]?.costoProyectado ?? 0)} detalle="último mes de la proyección" color="var(--ambar)" />
          </div>

          <p style={{ fontSize: "0.85rem", opacity: 0.75, marginBottom: "1rem" }}>{datos.metodologia}</p>

          <div style={{ background: "rgba(178,58,58,0.08)", border: "1px solid var(--rojo)", padding: "0.7rem 1rem", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
            ⚠ <strong>Sindicatos: no incluido.</strong> {datos.sindicatos.nota}
          </div>

          {datos.serie.length > 0 && (
            <LineChart width={600} height={280} data={datos.serie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Line type="monotone" dataKey="costoProyectado" stroke="#163A5C" strokeWidth={2} />
            </LineChart>
          )}

          {datos.serie.length > 0 && (
            <table style={{ fontSize: "0.85rem", maxWidth: "360px", marginTop: "1rem" }}>
              <thead><tr><th>Mes</th><th>Costo proyectado</th></tr></thead>
              <tbody>
                {datos.serie.map((s: any) => (
                  <tr key={s.mes}>
                    <td>{s.mes}</td>
                    <td style={{ textAlign: "right" }}>{money(s.costoProyectado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}

function Tarjeta({ titulo, valor, detalle, color }: { titulo: string; valor: string; detalle: string; color: string }) {
  return (
    <div style={{ background: "var(--gris-claro)", padding: "0.8rem 1.1rem", minWidth: "200px" }}>
      <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.7 }}>{titulo}</p>
      <p style={{ margin: "0.2rem 0", fontSize: "1.4rem", fontWeight: 700, color }}>{valor}</p>
      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.6 }}>{detalle}</p>
    </div>
  );
}
