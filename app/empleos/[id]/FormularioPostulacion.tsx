"use client";
// El formulario público de postulación. Pocos campos: quien busca trabajo
// desde el celular abandona un formulario largo.
import { useState } from "react";
import type { PreguntaPublica } from "@/lib/reclutamiento-filtros";
import CamposFiltro from "../CamposFiltro";

export default function FormularioPostulacion({ id, fuente, empresa, preguntas }: { id: string; fuente: string; empresa: string; preguntas: PreguntaPublica[] }) {
  const [estado, setEstado] = useState<"" | "enviando" | "listo">("");
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (estado) return;
    const datos = new FormData(e.currentTarget);
    const cv = datos.get("cv");
    if (cv instanceof File && cv.size > 4 * 1024 * 1024) { setError("El CV pesa más de 4 MB. Probá con un PDF más liviano."); return; }
    setEstado("enviando");
    setError("");
    try {
      const res = await fetch(`/api/empleos/${id}`, { method: "POST", body: datos });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No pudimos recibir tu postulación. Probá de nuevo."); setEstado(""); return; }
      setEstado("listo");
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEstado("");
    }
  }

  if (estado === "listo") return <div className="e-aviso ok"><strong>¡Recibimos tu postulación!</strong><br />Si tu perfil coincide con lo que buscamos, te vamos a contactar. Gracias por tu interés en {empresa}.</div>;

  return (
    <form className="e-caja" onSubmit={enviar}>
      <h2 style={{ marginTop: 0 }}>Postulate</h2>
      <div className="e-dos">
        <label className="e-campo">Nombre<input name="nombre" required maxLength={60} autoComplete="given-name" /></label>
        <label className="e-campo">Apellido<input name="apellido" required maxLength={60} autoComplete="family-name" /></label>
        <label className="e-campo">Teléfono <small>(con característica)</small><input name="telefono" type="tel" maxLength={40} autoComplete="tel" /></label>
        <label className="e-campo">Mail<input name="email" type="email" maxLength={120} autoComplete="email" /></label>
      </div>
      <label className="e-campo">Localidad <small>(opcional)</small><input name="localidad" maxLength={80} autoComplete="address-level2" /></label>
      {preguntas.length > 0 && <><h2>Algunas preguntas</h2><CamposFiltro preguntas={preguntas} clase="e-campo" /></>}
      <label className="e-campo">CV en PDF <small>(opcional, hasta 4 MB)</small><input name="cv" type="file" accept="application/pdf" /></label>
      <label className="e-campo">Contanos algo de vos <small>(opcional: experiencia, disponibilidad)</small><textarea name="mensaje" rows={4} maxLength={1500} /></label>
      {/* Trampa para robots: una persona no lo ve ni lo completa. */}
      <div className="e-trampa" aria-hidden="true"><label>Sitio web<input name="sitio" tabIndex={-1} autoComplete="off" /></label></div>
      <input type="hidden" name="f" value={fuente} />
      <label className="e-acepto"><input type="checkbox" name="consentimiento" required />
        <span>Acepto que {empresa} guarde y use los datos que envío para este proceso de selección y para futuras búsquedas. Puedo pedir que los borren cuando quiera.</span>
      </label>
      {error && <div className="e-aviso error" role="alert">{error}</div>}
      <button className="e-btn" type="submit" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Enviar mi postulación"}</button>
    </form>
  );
}
