// FM RRHH — app/empleos/page.tsx
// PÚBLICA: las búsquedas abiertas de UNA empresa (?e=<id>). Sin ese dato no
// lista nada: no hay un índice de todas las empresas que usan el sistema.
import type { Metadata } from "next";
import { prismaSistema } from "@/lib/prisma";
import "./empleos.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Empleos" };

export default async function Empleos({ searchParams }: { searchParams: { e?: string } }) {
  const id = /^[0-9a-f-]{36}$/i.test(searchParams.e ?? "") ? searchParams.e! : null;
  const empresa = id ? await prismaSistema.empresa.findUnique({ where: { id }, select: { razonSocial: true, nombreFantasia: true } }) : null;
  const busquedas = empresa ? await prismaSistema.busqueda.findMany({ where: { empresaId: id!, estado: "abierta", publica: true }, select: { id: true, titulo: true, lugar: true, descripcion: true }, orderBy: { abiertaEn: "desc" } }) : [];
  const nombre = empresa ? empresa.nombreFantasia || empresa.razonSocial : "";
  return (
    <div className="e-pagina">
      <div className="e-barra"><strong>{nombre || "Empleos"}</strong><span>Trabajá con nosotros</span></div>
      <div className="e-cuerpo">
        {!empresa ? (
          <div className="e-caja"><h1>Empleos</h1><p className="e-sub">Para ver las búsquedas de una empresa, entrá desde el enlace que te compartieron.</p></div>
        ) : (
          <>
            <h1>Búsquedas abiertas</h1>
            <p className="e-sub">{busquedas.length === 0 ? "Hoy no tenemos búsquedas abiertas. ¡Volvé a pasar!" : "Elegí la que te interese y postulate."}</p>
            {busquedas.map((b) => (
              <a key={b.id} href={`/empleos/${b.id}`} className="e-caja e-item">
                <strong>{b.titulo}</strong>{b.lugar && <span style={{ color: "#6b727b" }}> · {b.lugar}</span>}
                <div style={{ fontSize: "0.9rem", color: "#4a4f58", marginTop: 4 }}>{b.descripcion.slice(0, 160)}{b.descripcion.length > 160 && "…"}</div>
              </a>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
