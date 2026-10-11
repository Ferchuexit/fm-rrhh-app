// FM RRHH — app/api/empleos/[id]/route.ts
// PÚBLICA, sin sesión: alguien de afuera se postula a una búsqueda.
// Como la puede llamar cualquiera:
//   - solo acepta búsquedas abiertas y públicas;
//   - valida todo, el CV tiene que ser un PDF de verdad y de hasta 4 MB;
//   - no duplica a quien ya se postuló, y hay un tope por búsqueda;
//   - un campo trampa ("sitio") que una persona no ve y un robot completa;
//   - nunca devuelve datos de la empresa ni de otros candidatos.
import { NextResponse } from "next/server";
import { prismaSistema } from "@/lib/prisma";
import { validarPostulacion, fuenteValida, prepararCV, registrarPostulacion } from "@/lib/reclutamiento";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "No llegó el formulario. Probá de nuevo." }, { status: 400 });
    if (String(form.get("sitio") ?? "") !== "") return NextResponse.json({ ok: true }); // robot: se le dice que sí y no se guarda nada

    const busqueda = await prismaSistema.busqueda.findFirst({ where: { id: params.id, estado: "abierta", publica: true }, select: { id: true } });
    if (!busqueda) return NextResponse.json({ error: "Esta búsqueda ya no recibe postulaciones." }, { status: 409 });

    const { datos, error } = validarPostulacion(Object.fromEntries(form), true);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const cv = await prepararCV(form.get("cv") instanceof File ? (form.get("cv") as File) : null, busqueda.id);
    if ("error" in cv) return NextResponse.json({ error: cv.error }, { status: 400 });

    const r = await registrarPostulacion(prismaSistema, busqueda.id, datos, { fuente: fuenteValida(form.get("f")), cv, consentimiento: true });
    if (r === "llena") return NextResponse.json({ error: "Esta búsqueda ya no recibe postulaciones." }, { status: 409 });
    // "repetida" responde igual que "creada": no se le confirma a un
    // desconocido si un mail ya estaba postulado.
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/empleos/[id]:", e);
    return NextResponse.json({ error: "No pudimos recibir tu postulación. Probá de nuevo en un momento." }, { status: 500 });
  }
}
