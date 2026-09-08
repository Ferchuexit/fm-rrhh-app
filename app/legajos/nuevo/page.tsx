import LegajoForm from "../LegajoForm";

export default function NuevoLegajoPage() {
  return (
    <main>
      <h1>Nuevo empleado</h1>
      <p>El número de legajo se sugiere automáticamente (el siguiente libre) — se puede cambiar antes de guardar.</p>
      <LegajoForm />
    </main>
  );
}
