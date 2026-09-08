import LegajoForm from "../../LegajoForm";
import LegajoNavegacion from "./LegajoNavegacion";

export default function EditarLegajoPage({ params }: { params: { id: string } }) {
  return (
    <main>
      <h1>Editar empleado</h1>
      <LegajoNavegacion legajoId={params.id} />
      <LegajoForm legajoId={params.id} />
    </main>
  );
}
