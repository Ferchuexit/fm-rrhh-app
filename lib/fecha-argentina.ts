// FM RRHH — lib/fecha-argentina.ts
//
// Argentina no tiene horario de verano desde 2009 — siempre UTC-3, fijo.
// Esto arma "ahora" en el mismo formato que ya usa Fichada en toda la base
// (fecha = medianoche UTC del día local, hora = "HH:mm:ss" sin timezone),
// para que una fichada de terminal sea indistinguible de una importada del
// reloj físico a los ojos de motor-asistencia.mjs.
export function ahoraArgentina(): { fecha: Date; hora: string } {
  const ahoraUTC = new Date();
  const ahoraArg = new Date(ahoraUTC.getTime() - 3 * 60 * 60 * 1000);
  const fecha = new Date(Date.UTC(ahoraArg.getUTCFullYear(), ahoraArg.getUTCMonth(), ahoraArg.getUTCDate()));
  const hora = [ahoraArg.getUTCHours(), ahoraArg.getUTCMinutes(), ahoraArg.getUTCSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return { fecha, hora };
}

export function generarCodigoVinculacion(): string {
  // 6 dígitos, fácil de tipear a mano en una tablet — no necesita ser
  // criptográficamente fuerte, es de un solo uso y se invalida al vincular.
  return String(Math.floor(100000 + Math.random() * 900000));
}
