"use client";
import { useRef, useState } from "react";

const TOPE = 3 * 1024 * 1024;

// La foto de un celular pesa 4 a 8 MB — más que el tope de subida. Se
// achica en el propio teléfono (lado mayor 1800 px, JPG) antes de mandarla:
// un DNI se sigue leyendo perfecto y pasa de megas a unos cientos de KB.
async function achicarFoto(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error("imagen")); i.src = url; });
    const escala = Math.min(1, 1800 / Math.max(img.width, img.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const leerComoDataUrl = (archivo: File) => new Promise<string>((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => mal(r.error); r.readAsDataURL(archivo); });

export default function SubirDocumento({ tipo, pideDetalle, yaTiene }: { tipo: string; pideDetalle: boolean; yaTiene: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState("");
  const [estado, setEstado] = useState<"" | "preparando" | "subiendo">("");

  async function elegido(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // para poder volver a elegir el mismo archivo si falla
    if (!archivo) return;
    setError("");
    try {
      setEstado("preparando");
      let contenido: string;
      if (archivo.type === "application/pdf") {
        if (archivo.size > TOPE) throw new Error("El PDF pesa más de 3 MB. Subí uno más liviano o sacale fotos a las hojas.");
        contenido = await leerComoDataUrl(archivo);
      } else if (archivo.type.startsWith("image/")) {
        contenido = await achicarFoto(archivo).catch(() => { throw new Error("No se pudo leer esa imagen. Probá sacando la foto de nuevo."); });
      } else throw new Error("Solo se aceptan fotos o PDF.");

      setEstado("subiendo");
      const res = await fetch("/api/portal/legajo/documentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, detalle, contenidoBase64: contenido }) });
      const data = await res.json().catch(() => ({ error: "No hubo respuesta del servidor. Probá de nuevo." }));
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) throw new Error(data.error);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message === "Failed to fetch" ? "No hay conexión. El documento no se subió: probá de nuevo." : err?.message ?? "No se pudo subir.");
      setEstado("");
    }
  }

  return (
    <div style={{ marginTop: "0.6rem" }}>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      {pideDetalle && (
        <input className="p-detalle-doc" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={80} placeholder="¿Qué es? (opcional) — ej: Secundario completo" aria-label="Descripción del documento" />
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={elegido} />
      <button className="p-btn sec chico" style={{ marginTop: 0 }} disabled={estado !== ""} onClick={() => input.current?.click()}>
        {estado === "preparando" ? "Preparando…" : estado === "subiendo" ? "Subiendo…" : yaTiene ? "Subir otro" : "Subir foto o PDF"}
      </button>
    </div>
  );
}
