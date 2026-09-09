import type { MetadataRoute } from "next";

// FM RRHH — app/robots.ts
// Este sistema maneja datos reales de sueldos — no tiene que aparecer en
// ningún buscador. Bloquea TODO, sin excepciones (ni siquiera /login).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
