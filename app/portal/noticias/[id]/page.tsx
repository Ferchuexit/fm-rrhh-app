// FM RRHH — app/portal/noticias/[id]/page.tsx
// Una noticia. Abrirla ya la marca como leída.
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { noticiaDelEmpleado } from "@/lib/noticias";
import { fechaHora } from "../../formato";
import AcuseNoticia from "./AcuseNoticia";

export const dynamic = "force-dynamic";

export default async function PortalNoticia({ params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const n = await noticiaDelEmpleado(params.id, sesion.legajoId);
  if (!n) notFound();

  await prisma.noticiaLectura.upsert({ where: { noticiaId_legajoId: { noticiaId: n.id, legajoId: sesion.legajoId } }, create: { noticiaId: n.id, legajoId: sesion.legajoId }, update: {} });
  const acuseEn = n.lecturas[0]?.acuseEn ?? null;

  return (
    <>
      <a className="p-link" href="/portal/noticias">← Noticias</a>
      <h1>{n.titulo}</h1>
      <p className="p-sub" style={{ color: "#6b727b", fontSize: "0.85rem" }}>{fechaHora(n.publicadaEn)}</p>

      <div className="p-card">
        {/* Texto plano: React lo escapa, y pre-wrap respeta los saltos de línea de quien lo escribió. */}
        <div className="p-noticia-cuerpo">{n.cuerpo}</div>
        {n.adjuntoMime?.startsWith("image/") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/portal/noticias/${n.id}/adjunto`} alt={n.adjuntoNombre ?? "Imagen adjunta"} className="p-noticia-img" />
        )}
        {n.adjuntoMime === "application/pdf" && (
          <a className="p-btn sec" style={{ marginTop: "1rem", marginBottom: 0 }} href={`/api/portal/noticias/${n.id}/adjunto`} target="_blank" rel="noopener">Abrir el adjunto (PDF)</a>
        )}
      </div>

      {n.requiereAcuse && (acuseEn ? (
        <div className="p-aviso ok">Confirmaste la lectura el {fechaHora(acuseEn)}.</div>
      ) : (
        <AcuseNoticia id={n.id} />
      ))}
    </>
  );
}
