// FM RRHH — app/portal/chat/[id]/page.tsx
// Una conversación abierta.
import { redirect, notFound } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { conversacionPara, mensajesDe, marcarLeido } from "@/lib/chat";
import Hilo from "./Hilo";

export const dynamic = "force-dynamic";

export default async function PortalConversacion({ params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const c = await conversacionPara(params.id, sesion.legajoId);
  if (!c) notFound();
  const mensajes = await mensajesDe(c.conv.id, null);
  await marcarLeido(c.conv.id, sesion.legajoId);
  const sub = c.conv.tipo === "grupo" ? (c.conv.descripcion ?? (c.conv.soloAnuncios ? "Grupo de anuncios" : "Grupo")) : c.conv.tipo === "rrhh" ? "Tu consulta con Recursos Humanos. La ve solo RR.HH." : "Conversación privada entre ustedes dos.";
  return (
    <>
      <p style={{ margin: "0 0 0.3rem" }}><a href="/portal/chat" style={{ fontSize: "0.9rem" }}>‹ Chat</a></p>
      <h1 style={{ marginBottom: 0 }}>{c.conv.tipo === "grupo" ? `${c.conv.emoji} ` : ""}{c.titulo}</h1>
      <p className="p-sub">{sub}</p>
      <Hilo id={c.conv.id} yo={sesion.legajoId} grupo={c.conv.tipo === "grupo"} inicial={JSON.parse(JSON.stringify(mensajes))} noEscribe={c.noEscribe} />
    </>
  );
}
