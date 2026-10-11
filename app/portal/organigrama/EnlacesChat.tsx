"use client";
// El árbol en el portal: centrado en la persona, y (si la empresa permite
// los mensajes entre compañeros) cada nombre abre el chat con esa persona.
import Arbol, { type PersonaArbol } from "@/app/organigrama/Arbol";

export default function EnlacesChat({ personas, yoId, conChat }: { personas: PersonaArbol[]; yoId: string; conChat: boolean }) {
  return <Arbol personas={personas} yoId={yoId} enlace={(p) => (conChat && p.id !== yoId ? `/portal/chat?con=${p.id}` : null)} />;
}
