// FM RRHH — app/portal/biblioteca/[id]/page.tsx
// Un artículo de la Librería. Al abrirlo queda anotado que lo consultó.
import { redirect, notFound } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { articuloPara, emojiDeCategoria } from "@/lib/biblioteca";
import { fechaHora } from "../../formato";

export const dynamic = "force-dynamic";

// Si el enlace es un video de YouTube, se muestra ahí mismo.
function youtube(enlace: string): string | null {
  const m = enlace.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export default async function PortalArticulo({ params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const a = await articuloPara(params.id, sesion.legajoId, true);
  if (!a) notFound();
  const archivo = `/api/portal/biblioteca/${a.id}/archivo`;
  const video = a.enlace ? youtube(a.enlace) : null;

  return (
    <>
      <p style={{ margin: "0 0 0.3rem" }}><a href="/portal/biblioteca" style={{ fontSize: "0.9rem" }}>‹ Librería</a></p>
      <h1 style={{ marginBottom: 0 }}>{a.titulo}</h1>
      <p className="p-sub">{emojiDeCategoria(a.categoria)} {a.categoria} · Actualizado el {fechaHora(a.actualizadoEn).slice(0, 10)}</p>
      {a.contenido && <div className="p-card" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55 }}>{a.contenido}</div>}
      {video && <div style={{ position: "relative", paddingBottom: "56.25%", marginBottom: "0.9rem" }}><iframe src={video} title={a.titulo} allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: 8 }} /></div>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {a.archivoMime?.startsWith("image/") && <a href={archivo} target="_blank" rel="noopener"><img src={archivo} alt={a.titulo} style={{ width: "100%", borderRadius: 8, marginBottom: "0.9rem", background: "#eef2f5" }} /></a>}
      {a.archivoMime === "application/pdf" && <a href={archivo} target="_blank" rel="noopener" className="p-btn">📄 Abrir el documento (PDF)</a>}
      {a.enlace && !video && <a href={a.enlace} target="_blank" rel="noopener noreferrer" className="p-btn sec">🔗 Abrir el enlace</a>}
      <p className="p-pie">¿Te quedó una duda? <a href="/portal/chat">Escribile a RR.HH.</a></p>
    </>
  );
}
