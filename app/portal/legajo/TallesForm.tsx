"use client";
import { useState } from "react";

const ROPA = ["XS", "S", "M", "L", "XL", "XXL"];

export default function TallesForm({ ropa, calzado }: { ropa: string; calzado: string }) {
  const [r, setR] = useState(ROPA.includes(ropa) ? ropa : "");
  const [c, setC] = useState(calzado);
  const [msj, setMsj] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cambio = r !== ropa || c !== calzado;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsj(null);
    try {
      const res = await fetch("/api/portal/legajo/talles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ talleRopa: r, talleCalzado: c }) });
      const data = await res.json().catch(() => ({ error: "No hubo respuesta del servidor." }));
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setMsj({ tipo: "error", texto: data.error }); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setMsj({ tipo: "error", texto: "No hay conexión. Probá de nuevo." });
      setEnviando(false);
    }
  }

  return (
    <form className="p-card" onSubmit={guardar}>
      {msj && <div className={`p-aviso ${msj.tipo}`} role="alert">{msj.texto}</div>}
      <div className="p-fila2">
        <label className="p-campo">
          Ropa (remera / campera)
          <select value={r} onChange={(e) => setR(e.target.value)} required>
            <option value="">Elegí</option>
            {ROPA.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="p-campo">
          Calzado
          <input value={c} onChange={(e) => setC(e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} inputMode="decimal" placeholder="Ej: 42" required />
        </label>
      </div>
      <button className="p-btn" type="submit" disabled={enviando || !cambio} style={{ marginBottom: 0 }}>{enviando ? "Guardando…" : "Guardar talles"}</button>
    </form>
  );
}
