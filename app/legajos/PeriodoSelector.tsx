"use client";

export default function PeriodoSelector({ periodos, periodoActualId }: { periodos: any[]; periodoActualId?: string }) {
  return (
    <form method="get" style={{ marginBottom: "1rem" }}>
      <label>
        Período:{" "}
        <select
          name="periodoId"
          defaultValue={periodoActualId}
          onChange={(e) => e.currentTarget.form?.submit()}
        >
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.estado})
            </option>
          ))}
        </select>
      </label>{" "}
      <a href="/periodos" style={{ fontSize: "0.85rem" }}>+ Crear un período nuevo</a>
    </form>
  );
}
