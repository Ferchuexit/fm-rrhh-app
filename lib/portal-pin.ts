// FM RRHH — lib/portal-pin.ts
// Reglas del PIN del portal — funciones puras, sin base de datos, para
// poder probarlas solas (tests/portal-pin.test.mjs).
import { randomInt } from "crypto";

export const LARGO_PIN = 6;
export const MAX_INTENTOS_PIN = 5;
export const MINUTOS_BLOQUEO_PIN = 15;

export function soloDigitos(texto: unknown): string {
  return String(texto ?? "").replace(/\D/g, "");
}

// "111111", "123456", "654321" y parecidos: son lo primero que prueba
// cualquiera que quiera entrar al recibo de un compañero.
export function esPinTrivial(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  let asc = true;
  let desc = true;
  for (let i = 1; i < pin.length; i++) {
    const dif = Number(pin[i]) - Number(pin[i - 1]);
    if (dif !== 1) asc = false;
    if (dif !== -1) desc = false;
  }
  return asc || desc;
}

// Devuelve el motivo por el que el PIN no sirve, o null si está bien.
export function validarPinNuevo(pin: string, cuil: string): string | null {
  if (!new RegExp(`^\\d{${LARGO_PIN}}$`).test(pin)) return `El PIN tiene que tener exactamente ${LARGO_PIN} números.`;
  if (esPinTrivial(pin)) return "Ese PIN es demasiado fácil de adivinar (números iguales o en escalera). Elegí otro.";
  if (soloDigitos(cuil).includes(pin)) return "El PIN no puede ser parte de tu CUIL o DNI. Elegí otro.";
  return null;
}

// PIN temporal que RR.HH. le entrega al empleado. randomInt de `crypto`
// (no Math.random) — tiene que ser impredecible de verdad.
export function generarPinTemporal(cuil = ""): string {
  for (;;) {
    const pin = String(randomInt(0, 10 ** LARGO_PIN)).padStart(LARGO_PIN, "0");
    if (validarPinNuevo(pin, cuil) === null) return pin;
  }
}

// El empleado puede escribir su CUIL (11 dígitos, con o sin guiones) o
// solo el DNI (7 u 8). Devuelve con qué comparar, o null si no es ninguno.
export function interpretarIdentificacion(texto: unknown): { tipo: "cuil" | "dni"; valor: string } | null {
  const d = soloDigitos(texto);
  if (d.length === 11) return { tipo: "cuil", valor: d };
  if (d.length === 7 || d.length === 8) return { tipo: "dni", valor: d.padStart(8, "0") };
  return null;
}

// El DNI son los 8 dígitos del medio del CUIL (XX-DDDDDDDD-X).
export function coincideIdentificacion(cuilGuardado: string, ident: { tipo: "cuil" | "dni"; valor: string }): boolean {
  const cuil = soloDigitos(cuilGuardado);
  if (cuil.length !== 11) return false;
  return ident.tipo === "cuil" ? cuil === ident.valor : cuil.slice(2, 10) === ident.valor;
}
