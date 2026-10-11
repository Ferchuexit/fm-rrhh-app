// FM RRHH — app/empleos/[id]/page.tsx
// PÚBLICA: el aviso de una búsqueda y el formulario para postularse. La ve
// cualquiera con el enlace, sin sesión. Muestra SOLO lo que es del aviso
// (nunca datos internos del puesto, de la empresa ni de otros candidatos),
// y solo de búsquedas abiertas y marcadas como públicas.
import type { Metadata } from "next";
import { prismaSistema } from "@/lib/prisma";
import { fuenteValida } from "@/lib/reclutamiento-reglas";
import { preguntasPublicas } from "@/lib/reclutamiento-filtros";
import FormularioPostulacion from "./FormularioPostulacion";
import "../empleos.css";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f-]{36}$/i;

const buscar = (id: string) =>
  UUID.test(id)
    ? prismaSistema.busqueda.findFirst({ where: { id, publica: true, estado: { in: ["abierta", "pausada", "cerrada"] } }, select: { id: true, preguntas: true, titulo: true, descripcion: true, requisitos: true, ofrecemos: true, lugar: true, estado: true, empresaId: true, empresa: { select: { razonSocial: true, nombreFantasia: true } } } })
    : null;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const b = await buscar(params.id);
  return b ? { title: `${b.titulo} — ${b.empresa.nombreFantasia || b.empresa.razonSocial}`, description: b.descripcion.slice(0, 150) } : { title: "Búsqueda no disponible", robots: { index: false } };
}

export default async function Empleo({ params, searchParams }: { params: { id: string }; searchParams: { f?: string } }) {
  const b = await buscar(params.id);
  const empresa = b ? b.empresa.nombreFantasia || b.empresa.razonSocial : "";
  return (
    <div className="e-pagina">
      <div className="e-barra"><strong>{empresa || "Empleos"}</strong><span>Trabajá con nosotros</span></div>
      <div className="e-cuerpo">
        {!b ? (
          <div className="e-caja"><h1>Esta búsqueda no está disponible</h1><p className="e-sub">Puede que el enlace esté mal copiado o que la búsqueda ya no exista.</p></div>
        ) : (
          <>
            <h1>{b.titulo}</h1>
            <p className="e-sub">{empresa}{b.lugar && ` · ${b.lugar}`}</p>
            <div className="e-caja">
              <p className="e-texto">{b.descripcion}</p>
              {b.requisitos && <><h2>Requisitos</h2><p className="e-texto">{b.requisitos}</p></>}
              {b.ofrecemos && <><h2>Ofrecemos</h2><p className="e-texto">{b.ofrecemos}</p></>}
            </div>
            {b.estado === "abierta"
              ? <FormularioPostulacion id={b.id} fuente={fuenteValida(searchParams.f)} empresa={empresa} preguntas={preguntasPublicas(b.preguntas)} />
              : <div className="e-aviso ok">Esta búsqueda ya no recibe postulaciones. ¡Gracias por tu interés!</div>}
            <p className="e-pie"><a href={`/empleos?e=${b.empresaId}`}>Ver todas las búsquedas de {empresa}</a></p>
          </>
        )}
      </div>
    </div>
  );
}
