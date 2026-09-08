// FM RRHH — lib/email.ts
//
// Envío de mail vía Resend (https://resend.com) — elegido porque tiene un
// nivel gratuito real, no pide verificar dominio para probar (se puede
// mandar desde onboarding@resend.dev mientras se prueba), y su API es un
// solo POST con fetch — no hace falta instalar ningún paquete nuevo.
//
// CONFIGURACIÓN NECESARIA (agregar a .env.local):
//   RESEND_API_KEY=re_xxxxxxxx       ← se consigue gratis en resend.com,
//                                       sin tarjeta, en dashboard > API Keys
//   EMAIL_REMITENTE=onboarding@resend.dev   ← para pruebas. Cuando el
//                                       dominio real de la consultora esté
//                                       verificado en Resend, cambiar acá
//                                       (ej. reportes@fmconsultora.com.ar)
//
// Mientras no se verifique un dominio propio, Resend en modo gratuito solo
// deja mandar a la MISMA casilla con la que te registraste en Resend — es
// justo el caso de Fernando probando con fm_consultora_rrhh@icloud.com, así
// que andá a resend.com, registrate con esa casilla, y ya podés probar.
export interface AdjuntoEmail {
  nombreArchivo: string;
  contenido: Buffer;
}

export async function enviarEmail({
  destinatarios,
  asunto,
  html,
  adjuntos = [],
}: {
  destinatarios: string[];
  asunto: string;
  html: string;
  adjuntos?: AdjuntoEmail[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.EMAIL_REMITENTE || "onboarding@resend.dev";

  if (!apiKey) {
    return { ok: false, error: "Falta RESEND_API_KEY en .env.local — ver el comentario al principio de lib/email.ts para configurarlo." };
  }
  if (destinatarios.length === 0) {
    return { ok: false, error: "No hay ningún destinatario." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `FM RRHH <${remitente}>`,
        to: destinatarios,
        subject: asunto,
        html,
        attachments: adjuntos.map((a) => ({
          filename: a.nombreArchivo,
          content: a.contenido.toString("base64"),
        })),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.message ?? `Resend devolvió un error (${res.status}).` };
    }
    return { ok: true, id: data.id };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "No se pudo conectar con el servicio de mail." };
  }
}
