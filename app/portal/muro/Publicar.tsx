"use client";
// Publicar en el muro: un texto y, si quiere, una foto. La foto se achica
// en el celular antes de subirla: las de la cámara pesan más de lo que el
// servidor acepta, y así además carga rápido para todos.
import { useState } from "react";

async function achicar(archivo: File, lado = 1600, calidad = 0.82): Promise<Blob> {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("sin imagen"))), "image/jpeg", calidad));
}

export default function Publicar({ conAprobacion }: { conAprobacion: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [vista, setVista] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    setError("");
    if (!archivo) return;
    try {
      const chica = await achicar(archivo);
      setFoto(chica);
      setVista(URL.createObjectURL(chica));
    } catch {
      setError("No se pudo leer esa foto. Probá con otra (JPG o PNG).");
    }
  }
  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const form = new FormData();
      form.set("texto", texto);
      if (foto) form.set("foto", foto, "foto.jpg");
      const res = await fetch("/api/portal/publicaciones", { method: "POST", body: form });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No se pudo publicar."); setEnviando(false); return; }
      if (d.pendiente) { setAviso("Listo. RR.HH. la revisa y, cuando le dé el visto bueno, la ven todos."); setAbierto(false); setTexto(""); setFoto(null); setVista(""); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }

  if (!abierto) return (
    <>
      {aviso && <div className="p-aviso ok">{aviso}</div>}
      <button className="p-btn sec" onClick={() => { setAviso(""); setAbierto(true); }}>📷 Publicar en el muro</button>
    </>
  );
  return (
    <div className="p-card">
      <label className="p-campo">¿Qué querés compartir?<textarea rows={3} maxLength={1500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Un logro del equipo, una foto del trabajo terminado, algo para festejar…" /></label>
      {vista && <img src={vista} alt="Vista previa de la foto" style={{ width: "100%", borderRadius: 8, marginBottom: "0.6rem" }} />}
      <label className="p-campo">{vista ? "Cambiar la foto" : "Foto (opcional)"}<input type="file" accept="image/*" onChange={elegir} /></label>
      {foto && <button className="p-btn chico sec" style={{ marginTop: 0 }} onClick={() => { setFoto(null); setVista(""); }}>Quitar la foto</button>}
      <p className="p-sub" style={{ fontSize: "0.8rem" }}>Lo ven todos tus compañeros. No subas fotos de otras personas sin preguntarles{conAprobacion ? ". RR.HH. revisa cada publicación antes de que salga." : "."}</p>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" onClick={enviar} disabled={enviando || (!foto && texto.trim().length < 3)}>{enviando ? "Publicando…" : "Publicar"}</button>
      <button className="p-btn sec" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</button>
    </div>
  );
}
