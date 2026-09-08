"use client";
import { useState, useEffect } from "react";

function money(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function Flecha({ valor, invertido = false }: { valor: number | null; invertido?: boolean }) {
  // invertido=true para métricas donde "subir" es malo (ausentismo) — el
  // color se invierte, la flecha no.
  if (valor === null) return <span style={{ opacity: 0.4, fontSize: "0.8rem" }}>sin dato anterior</span>;
  const sube = valor > 0;
  const bueno = invertido ? !sube : sube;
  const color = valor === 0 ? "#666" : bueno ? "#2F6F5E" : "#B8752B";
  const flecha = valor === 0 ? "→" : sube ? "↑" : "↓";
  return <span style={{ color, fontSize: "0.85rem", fontWeight: "bold" }}>{flecha} {Math.abs(valor).toFixed(1)}</span>;
}

function Tarjeta({ titulo, valor, delta }: { titulo: string; valor: string; delta: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #dfe4e8", borderRadius: "6px", padding: "1.2rem", minWidth: "180px", flex: 1 }}>
      <div style={{ fontSize: "0.78rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.03em" }}>{titulo}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: "bold", margin: "0.3rem 0" }}>{valor}</div>
      <div>{delta}</div>
    </div>
  );
}

export default function CentroControl({ periodoId }: { periodoId: string }) {
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!periodoId) return;
    setCargando(true);
    setError("");
    fetch(`/api/centro-control?periodoId=${periodoId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setDatos(d);
      })
      .catch(() => setError("No se pudo cargar el centro de control."))
      .finally(() => setCargando(false));
  }, [periodoId]);

  if (cargando) return <p style={{ opacity: 0.6 }}>Cargando centro de control...</p>;
  if (error) return <p style={{ color: "#B23A3A" }}>{error}</p>;
  if (!datos) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ marginBottom: "0.3rem" }}>Centro de Control RR.HH.</h3>
      <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: 0 }}>
        {datos.periodoAnterior ? `${datos.periodoAnterior.nombre} → ${datos.periodoActual.nombre}` : `${datos.periodoActual.nombre} (sin período anterior para comparar)`}
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Tarjeta
          titulo="Costo laboral"
          valor={`$${money(datos.costoLaboral.actual)}`}
          delta={<Flecha valor={datos.costoLaboral.variacionPct} invertido />}
        />
        <Tarjeta
          titulo="Dotación"
          valor={String(datos.dotacion.actual)}
          delta={datos.dotacion.anterior !== null ? <Flecha valor={datos.dotacion.actual - datos.dotacion.anterior} /> : <Flecha valor={null} />}
        />
        <Tarjeta
          titulo="Ausentismo"
          valor={datos.ausentismoPct.actual !== null ? `${datos.ausentismoPct.actual.toFixed(1)}%` : "—"}
          delta={<Flecha valor={datos.ausentismoPct.variacionPuntos} invertido />}
        />
        <Tarjeta
          titulo="Horas extra (importe)"
          valor={`$${money(datos.horasExtra.actual)}`}
          delta={<Flecha valor={datos.horasExtra.variacionPct} invertido />}
        />
        <Tarjeta
          titulo="Costo por empleado"
          valor={`$${money(datos.costoPorEmpleado.actual)}`}
          delta={<Flecha valor={datos.costoPorEmpleado.variacionPct} invertido />}
        />
        <Tarjeta
          titulo="Alertas"
          valor={`🔴 ${datos.alertas.rojas}  🟡 ${datos.alertas.amarillas}`}
          delta={<span style={{ fontSize: "0.78rem", opacity: 0.6 }}>ver detalle en /auditoria</span>}
        />
      </div>
      <p style={{ fontSize: "0.72rem", opacity: 0.5, marginTop: "0.6rem" }}>
        Ausentismo es una aproximación (horas de ausencia cargadas / horas teóricas de la nómina), no una tasa exacta de asistencia real.
      </p>
    </div>
  );
}
