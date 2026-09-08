import { redirect } from "next/navigation";

// FM RRHH — app/liquidar/page.tsx
// Esta pantalla se renombró a "Liquidación Masiva" (ver
// app/liquidacion-masiva/page.tsx) para separarla de la nueva Liquidación
// Individual — ver "Rediseño del módulo de Liquidaciones", punto 1.
//
// Se deja este redirect (en vez de borrar la carpeta sin más) para no romper
// ningún bookmark o link viejo a /liquidar que haya quedado dando vueltas —
// preserva periodoId si venía en la URL.
export default function LiquidarRedirect({ searchParams }: { searchParams: { periodoId?: string } }) {
  const destino = searchParams.periodoId
    ? `/liquidacion-masiva?periodoId=${searchParams.periodoId}`
    : "/liquidacion-masiva";
  redirect(destino);
}
