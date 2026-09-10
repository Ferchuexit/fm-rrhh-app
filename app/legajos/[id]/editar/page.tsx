import LegajoForm from "../../LegajoForm";
import LegajoNavegacion from "./LegajoNavegacion";

export default function EditarLegajoPage({ params }: { params: { id: string } }) {
  return (
    <main>
      <h1>Editar empleado</h1>
      <LegajoNavegacion legajoId={params.id} />
      <p style={{ fontSize: "0.85rem" }}>
        <a href={`/legajos/${params.id}/biometria`}>📷 Biometría (Control de Asistencia) →</a>
      </p>
      <LegajoForm legajoId={params.id} />
    </main>
  );
}
