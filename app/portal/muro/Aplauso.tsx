"use client";
import { useState } from "react";

export default function Aplauso({ id, aplausos, aplaudido }: { id: string; aplausos: number; aplaudido: boolean }) {
  const [e, setE] = useState({ aplausos, aplaudido });
  async function tocar() {
    const antes = e;
    setE({ aplaudido: !e.aplaudido, aplausos: e.aplausos + (e.aplaudido ? -1 : 1) }); // se ve al instante
    try {
      const res = await fetch(`/api/portal/reconocimientos/${id}`, { method: "POST" });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      const d = await res.json().catch(() => null);
      setE(res.ok && d ? { aplaudido: d.aplaudido, aplausos: d.aplausos } : antes);
    } catch { setE(antes); }
  }
  return <button onClick={tocar} aria-pressed={e.aplaudido} aria-label={e.aplaudido ? "Quitar mi aplauso" : "Aplaudir"} style={{ marginTop: "0.5rem", padding: "0.3rem 0.7rem", borderRadius: 999, fontSize: "0.9rem", cursor: "pointer", border: e.aplaudido ? "2px solid #163A5C" : "1px solid #b9c4cd", background: e.aplaudido ? "#e8f0f6" : "#fff", color: "#12202e", fontWeight: e.aplaudido ? 700 : 400 }}>👏 {e.aplausos > 0 ? e.aplausos : "Aplaudir"}</button>;
}
