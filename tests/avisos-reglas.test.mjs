// Avisos a los empleados: qué dice cada uno (lib/avisos-reglas.ts).
import { describe, it, expect } from "vitest";
import * as A from "../lib/avisos-reglas.ts";

const f = (t) => new Date(t + "T00:00:00Z");

describe("Textos", () => {
  it("recibo: nombra el período y lleva a Recibos", () => {
    expect(A.avisoReciboDisponible("Julio 2026")).toMatchObject({ tipo: "recibo", url: "/portal/recibos" });
    expect(A.avisoReciboDisponible("Julio 2026").cuerpo).toContain("Julio 2026");
  });
  it("respuesta a un pedido: al empleado y al jefe se les dice distinto", () => {
    const base = { tipo: "vacaciones", desde: f("2027-01-11"), hasta: f("2027-01-17") };
    expect(A.avisoSolicitudRespondida({ ...base, estado: "aprobada" })).toMatchObject({ titulo: "RR.HH. aprobó las vacaciones", url: "/portal/vacaciones" });
    expect(A.avisoSolicitudRespondida({ ...base, estado: "aprobada" }).cuerpo).toContain("del 11/01 al 17/01");
    const alJefe = A.avisoSolicitudRespondida({ ...base, estado: "rechazada", paraOtro: "Pablo Duarte" });
    expect(alJefe).toMatchObject({ titulo: "RR.HH. no aprobó las vacaciones de Pablo Duarte", url: "/portal/equipo" });
    expect(A.avisoSolicitudRespondida({ tipo: "permiso", estado: "aprobada", desde: f("2026-12-01"), hasta: f("2026-12-01") }).cuerpo).toContain("el 01/12");
  });
  it("todos los enlaces son del portal", () => {
    const todos = [A.avisoReciboDisponible("x"), A.avisoVacacionesConfirmadas(f("2027-01-11"), f("2027-01-17")), A.avisoPedidoDelJefe(f("2027-01-11"), f("2027-01-17")), A.avisoNoticia("Título", true), A.avisoDocumentoRechazado(), A.avisoCambioDatosRespondido(true), A.avisoCambioDatosRespondido(false), A.avisoDePrueba()];
    for (const a of todos) {
      expect(a.url.startsWith("/portal"), a.titulo).toBe(true);
      expect(a.titulo.length).toBeLessThanOrEqual(60); // entero en la pantalla bloqueada
      expect(a.cuerpo.length).toBeLessThanOrEqual(160);
    }
  });
});

describe("Privacidad: se leen con el celular bloqueado", () => {
  it("un rechazo no lleva el motivo; un documento rechazado no dice cuál", () => {
    const r = A.avisoSolicitudRespondida({ tipo: "permiso", estado: "rechazada", desde: f("2026-12-01"), hasta: f("2026-12-01") });
    expect(r.cuerpo).toMatch(/Entrá para ver el motivo/);
    expect(A.avisoDocumentoRechazado.length).toBe(0); // la función ni siquiera recibe el nombre del documento
    expect(A.avisoDocumentoRechazado().cuerpo).not.toMatch(/certificado|médico/i);
  });
  it("una noticia larga se recorta", () => {
    expect(A.avisoNoticia("x".repeat(500), false).cuerpo.length).toBe(120);
    expect(A.avisoNoticia("Corte de luz", true).titulo).toMatch(/confirmar lectura/);
  });
});

describe("Mail y dispositivo", () => {
  it("el mail escapa lo que venga de afuera y arma el enlace completo", () => {
    const html = A.htmlDelAviso(A.avisoNoticia('<script>alert(1)</script> "hola"', false), "Julián <b>", "Moras & Cía", "https://ejemplo.com");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Moras &amp; Cía");
    expect(html).toContain("Julián &lt;b&gt;");
    expect(html).toContain('href="https://ejemplo.com/portal/noticias"');
  });
  it("reconoce el celular para mostrárselo al empleado", () => {
    expect(A.nombreDispositivo("Mozilla/5.0 (Linux; Android 14; SM-A546) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36")).toBe("Android · Chrome");
    expect(A.nombreDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1")).toBe("iPhone · Safari");
    expect(A.nombreDispositivo("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36")).toBe("Android · Samsung Internet");
    expect(A.nombreDispositivo("")).toBe("Otro equipo · navegador");
  });
});

describe("Dirección del servicio de notificaciones", () => {
  it("acepta los servicios reales", () => {
    for (const e of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://web.push.apple.com/abc", "https://db5p.notify.windows.com/w/?token=abc"]) expect(A.endpointPushValido(e), e).toBe(true);
  });
  it("rechaza cualquier otra dirección, aunque se parezca", () => {
    for (const e of ["http://fcm.googleapis.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://192.168.0.10/x", "https://intranet/x", "https://fcm.googleapis.com.atacante.com/x", "https://atacantefcm.googleapis.com.ar/x", "https://usuario:clave@fcm.googleapis.com/x", "nada", "", "https://fcm.googleapis.com/" + "x".repeat(1000)]) {
      expect(A.endpointPushValido(e), e).toBe(false);
    }
    expect(A.endpointPushValido(undefined)).toBe(false);
  });
  it("el host de prueba solo vale si se lo agrega a propósito", () => {
    expect(A.endpointPushValido("https://push.prueba.test:8443/x")).toBe(false);
    expect(A.endpointPushValido("https://push.prueba.test:8443/x", ["push.prueba.test"])).toBe(true);
  });
});
