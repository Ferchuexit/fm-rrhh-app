"use client";
// FM RRHH — app/firmas-recibos/page.tsx
// Seguimiento de entrega y firma de recibos por período.
import { useEffect, useState } from "react";

type Recibo = {
  liquidacionId: string; version: number; neto: number; numeroLegajo: number; apellido: string; nombre: string;
  acceso: "sin_acceso" | "pin_temporal" | "activo" | "desactivado";
  vistoEn: string | null; firma: "conforme" | "disconforme" | null; firmadoEn: string | null; observacion: string | null; ipFirma: string | null; hashContenido: string | null;
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";

const TEXTO_ACCESO: Record<Recibo["acceso"], string> = {
  sin_acceso: "Sin acceso al portal",
  pin_temporal: "Tiene PIN, nunca entró",
  desactivado: "Acceso desactivado",
  activo: "",
};

function estado(r: Recibo): { texto: string; color: string; orden: number } {
  if (r.firma === "disconforme") return { texto: "Firmado en disconformidad", color: "#B23A3A", orden: 0 };
  if (r.firma === "conforme") return { texto: "Firmado", color: "#2F6F5E", orden: 3 };
  if (r.vistoEn) return { texto: "Visto, sin firmar", color: "#B8752B", orden: 1 };
  return { texto: "Sin ver", color: "#6b727b", orden: 2 };
}

export default function FirmasRecibosPage() {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [datos, setDatos] = useState<{ periodo: { nombre: string; estado: string; publicado: boolean }; recibos: Recibo[] } | null>(null);
  const [error, setError] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then((ps) => {
      setPeriodos(ps);
      const desdeUrl = new URLSearchParams(window.location.search).get("periodoId");
      const cerrado = ps.find((p: any) => p.estado === "cerrada");
      setPeriodoId(desdeUrl && ps.some((p: any) => p.id === desdeUrl) ? desdeUrl : cerrado?.id ?? ps[0]?.id ?? "");
    });
  }, []);

  useEffect(() => {
    if (!periodoId) return;
    setDatos(null);
    setError("");
    fetch(`/api/firmas-recibos?periodoId=${periodoId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setDatos(d);
      })
      .catch((e) => setError(e.message ?? "No se pudo cargar."));
  }, [periodoId]);

  const recibos = datos?.recibos ?? [];
  const firmados = recibos.filter((r) => r.firma === "conforme").length;
  const disconformes = recibos.filter((r) => r.firma === "disconforme").length;
  const vistos = recibos.filter((r) => !r.firma && r.vistoEn).length;
  const sinVer = recibos.length - firmados - disconformes - vistos;
  const visibles = recibos.filter((r) => !soloPendientes || r.firma !== "conforme").sort((a, b) => estado(a).orden - estado(b).orden || a.numeroLegajo - b.numeroLegajo);

  function exportar() {
    const filas = [
      ["Legajo", "Apellido", "Nombre", "Estado", "Visto", "Firmado", "Observación", "IP", "Versión liquidación", "Huella del contenido (SHA-256)"],
      ...recibos.map((r) => [r.numeroLegajo, r.apellido, r.nombre, estado(r).texto, fecha(r.vistoEn), fecha(r.firmadoEn), r.observacion ?? "", r.ipFirma ?? "", r.version, r.hashContenido ?? ""]),
    ];
    const csv = "﻿" + filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `firmas_recibos_${(datos?.periodo.nombre ?? "periodo").replace(/[^\w.-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const caja = (n: number, texto: string, color: string) => (
    <div style={{ background: "white", border: "1px solid #dfe4e8", borderTop: `4px solid ${color}`, padding: "0.75rem 1rem", minWidth: "150px" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color }}>{n}</div>
      <div style={{ fontSize: "0.85rem" }}>{texto}</div>
    </div>
  );

  return (
    <main>
      <h1>Firmas de recibos</h1>
      <p style={{ maxWidth: "820px" }}>
        Quién vio y quién firmó su recibo en el portal del empleado. Las firmas no se pueden editar ni borrar; si un período se vuelve a liquidar,
        la versión nueva necesita una firma nueva.
      </p>

      <label>
        Período:{" "}
        <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} style={{ padding: "0.4rem" }}>
          {periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>)}
        </select>
      </label>

      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && periodoId && <p>Cargando…</p>}

      {datos && !datos.periodo.publicado && (
        <p style={{ background: "#fdf1e1", border: "1px solid #efcf9f", padding: "0.6rem 0.8rem", maxWidth: "900px" }}>
          Este período está en estado <strong>{datos.periodo.estado}</strong>: sus recibos <strong>todavía no se ven en el portal</strong>. Se publican solos
          cuando lo cerrás en <a href="/auditoria">Auditoría y cierre</a>.
        </p>
      )}

      {datos && (
        <>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1rem 0" }}>
            {caja(firmados, "Firmados", "#2F6F5E")}
            {caja(disconformes, "En disconformidad", "#B23A3A")}
            {caja(vistos, "Vistos sin firmar", "#B8752B")}
            {caja(sinVer, "Sin ver", "#6b727b")}
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <label><input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Ocultar los ya firmados en conformidad</label>
            <button onClick={exportar} disabled={recibos.length === 0}>⬇ Exportar constancia (Excel/CSV)</button>
          </div>

          <table style={{ maxWidth: "1100px" }}>
            <thead><tr><th>Legajo</th><th>Empleado</th><th>Estado</th><th>Visto</th><th>Firmado</th><th>Observación del empleado</th></tr></thead>
            <tbody>
              {visibles.map((r) => {
                const est = estado(r);
                return (
                  <tr key={r.liquidacionId}>
                    <td>{r.numeroLegajo}</td>
                    <td>{r.apellido}, {r.nombre}</td>
                    <td>
                      <span style={{ color: est.color, fontWeight: 600 }}>{est.texto}</span>
                      {!r.firma && TEXTO_ACCESO[r.acceso] && <div style={{ fontSize: "0.78rem", color: "#6b727b" }}>{TEXTO_ACCESO[r.acceso]}</div>}
                    </td>
                    <td>{fecha(r.vistoEn)}</td>
                    <td>{fecha(r.firmadoEn)}</td>
                    <td style={{ maxWidth: "320px" }}>{r.observacion}</td>
                  </tr>
                );
              })}
              {visibles.length === 0 && <tr><td colSpan={6}>{recibos.length === 0 ? "Este período no tiene liquidaciones." : "No queda ninguno pendiente."}</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
