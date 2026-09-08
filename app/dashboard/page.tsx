"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import CentroControl from "./CentroControl";
import BotonInformeGerencial from "./BotonInformeGerencial";

const COLORES = ["#3C5A78", "#6E8CAE", "#B8752B", "#8C6A9C", "#9A9A8E", "#2F6F5E"];
const ICONO: Record<string, string> = { rojo: "🔴", amarillo: "🟡", verde: "🟢" };
const COLOR_SEV: Record<string, string> = { rojo: "#B23A3A", amarillo: "#B8752B", verde: "#2F6F5E" };

function money(v: number) {
  return "$ " + Math.round(v).toLocaleString("es-AR");
}

function KpiCard({ titulo, kpi }: { titulo: string; kpi: any }) {
  const color = kpi.semaforo ? COLOR_SEV[kpi.semaforo] : "#163A5C";
  return (
    <div style={{ border: `2px solid ${color}`, background: "white", padding: "1rem", minWidth: "260px" }}>
      <div style={{ fontSize: "0.75rem", textTransform: "uppercase", opacity: 0.7, marginBottom: "0.25rem" }}>{titulo}</div>
      {kpi.valor != null && typeof kpi.valor !== "object" && (
        <div style={{ fontSize: "1.3rem", fontWeight: "bold", color }}>
          {kpi.unidad === "$" ? money(kpi.valor) : `${kpi.valor}${kpi.unidad ?? ""}`}
        </div>
      )}
      <div style={{ fontSize: "0.8rem", opacity: 0.85, marginTop: "0.25rem" }}>{kpi.insight}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [periodoId, setPeriodoId] = useState("");
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [tab, setTab] = useState("personal");
  const [datos, setDatos] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then((ps) => {
      setPeriodos(ps);
      const desdeUrl = new URLSearchParams(window.location.search).get("periodoId");
      setPeriodoId(desdeUrl && ps.some((p: any) => p.id === desdeUrl) ? desdeUrl : ps[0]?.id ?? "");
    });
  }, []);

  async function cargar() {
    if (!periodoId) return;
    const [resD, resK] = await Promise.all([
      fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodoId }) }),
      fetch("/api/kpis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodoId }) }),
    ]);
    try {
      setDatos(await resD.json());
      setKpis(await resK.json());
    } catch {
      setDatos(null);
      alert("El servidor no devolvió una respuesta válida.");
    }
  }

  useEffect(() => {
    if (periodoId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoId]);

  const TABS = [
    ["personal", "Personal"],
    ["ausentismo", "Ausentismo"],
    ["costos", "Costos"],
    ["liquidacion", "Liquidación"],
    ["decision", "Decisión"],
  ];

  return (
    <main>
      <h1>Dashboard</h1>
      <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} style={{ marginRight: "0.5rem" }}>
        {periodos.length === 0 && <option value="">No hay períodos cargados todavía</option>}
        {periodos.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>
        ))}
      </select>
      <button onClick={cargar}>Cargar</button>

      {periodoId && (
        <div style={{ marginTop: "1.5rem" }}>
          <CentroControl periodoId={periodoId} />
          <BotonInformeGerencial periodoId={periodoId} />
        </div>
      )}

      {datos && (
        <>
          <div style={{ margin: "1.5rem 0" }}>
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  marginRight: "0.5rem",
                  background: tab === key ? "#163A5C" : "white",
                  color: tab === key ? "white" : "#163A5C",
                  border: "1px solid #163A5C",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "personal" && (
            <div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                <KpiCard titulo="Dotación actual" kpi={{ valor: datos.personal.dotacion, insight: "" }} />
                <KpiCard titulo="Altas (período)" kpi={{ valor: datos.personal.altas, insight: "" }} />
                <KpiCard titulo="Bajas (período)" kpi={{ valor: datos.personal.bajas, insight: "" }} />
                <KpiCard titulo="Antigüedad promedio" kpi={{ valor: datos.personal.antiguedadPromedioAnios.toFixed(1), unidad: " años", insight: "" }} />
              </div>
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                <div>
                  <h4>Por convenio</h4>
                  <BarChart width={300} height={200} data={datos.personal.porConvenio}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="convenio" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="cantidad" fill="#3C5A78" />
                  </BarChart>
                </div>
                <div>
                  <h4>Por categoría</h4>
                  <PieChart width={300} height={200}>
                    <Pie data={datos.personal.porCategoria} dataKey="cantidad" nameKey="categoria" outerRadius={70} label={(e: any) => e.categoria}>
                      {datos.personal.porCategoria.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORES[i % COLORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </div>
              </div>
            </div>
          )}

          {tab === "ausentismo" && (
            <div>
              {datos.ausentismo.nota && <p style={{ opacity: 0.7, fontStyle: "italic" }}>{datos.ausentismo.nota}</p>}
              {datos.ausentismo.items.length > 0 && (
                <BarChart width={400} height={220} data={datos.ausentismo.items} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="tipo" width={140} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="horas" fill="#B8752B" />
                </BarChart>
              )}
            </div>
          )}

          {tab === "costos" && (
            <div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <KpiCard titulo="Masa salarial" kpi={{ valor: datos.costos.masaSalarial, unidad: "$", insight: "" }} />
                <KpiCard titulo="Costo por empleado" kpi={{ valor: datos.costos.costoPorEmpleado, unidad: "$", insight: "" }} />
                <KpiCard titulo="Horas extra (total $)" kpi={{ valor: datos.costos.horasExtraTotal, unidad: "$", insight: "" }} />
              </div>
              <p style={{ marginTop: "1rem", opacity: 0.7, fontStyle: "italic", fontSize: "0.85rem" }}>{datos.costos.nota}</p>
            </div>
          )}

          {tab === "liquidacion" && (
            <div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <KpiCard titulo="Bruto" kpi={{ valor: datos.liquidacion.bruto, unidad: "$", insight: "" }} />
                <KpiCard titulo="Neto" kpi={{ valor: datos.liquidacion.neto, unidad: "$", insight: "" }} />
              </div>
              <p style={{ marginTop: "1rem", opacity: 0.7, fontStyle: "italic", fontSize: "0.85rem" }}>{datos.liquidacion.nota}</p>
            </div>
          )}

          {tab === "decision" && kpis && (
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <KpiCard titulo="Horas extra % masa salarial" kpi={kpis.horasExtra} />
              <KpiCard titulo="Rotación anualizada (aprox.)" kpi={kpis.rotacion} />
              <KpiCard titulo="Tendencia de ausentismo" kpi={kpis.tendenciaAusentismo} />
              <KpiCard titulo="Pirámide de antigüedad" kpi={{ ...kpis.piramide, valor: null }} />
              <KpiCard titulo="Cerca del piso de escala" kpi={kpis.cercaDePiso} />
              <KpiCard titulo="Proyección costo laboral" kpi={kpis.proyeccion} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
