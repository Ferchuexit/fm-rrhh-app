"use client";

export default function BotonInformeGerencial({ periodoId }: { periodoId: string }) {
  return (
    <a
      href={periodoId ? `/api/informe-gerencial?periodoId=${periodoId}` : undefined}
      onClick={(e) => { if (!periodoId) { e.preventDefault(); alert("Elegí un período primero."); } }}
      style={{
        display: "inline-block", background: "#163A5C", color: "white",
        padding: "0.7rem 1.4rem", borderRadius: "4px", textDecoration: "none",
        fontWeight: "bold", marginBottom: "1rem",
      }}
    >
      📄 Generar Informe Gerencial
    </a>
  );
}
