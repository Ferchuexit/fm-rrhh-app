# 102 — Banco de horas

Compensar horas extra con descanso en lugar de pagarlas, según el **art. 197 bis de la LCT** (texto del art. 42 de la **Ley 27.802 de Modernización Laboral**, B.O. 06/03/2026) y el **art. 198** (art. 43 de la ley).

## Qué pide la ley y cómo lo cumple el sistema

| La ley pide | En el sistema |
|---|---|
| Acuerdo **voluntario y por escrito** entre empleador y trabajador, o con la representación sindical | `AcuerdoBancoHoras`. Se propone desde `/banco-horas`; el empleado lo lee (PDF) y lo **acepta en el portal** (queda fecha, hora e IP), o se imprime y se marca "firmado en papel". Sin acuerdo firmado, nada entra al banco: se paga. |
| Fijar el carácter voluntario y los **límites** | Cláusulas del PDF (`lib/banco-horas-pdf.ts`): voluntariedad, tope de horas acumuladas, plazo para compensar, equivalencia. |
| Un **método de control** de las horas trabajadas y disponibles | La cuenta corriente `MovimientoBancoHoras`, alimentada por las fichadas. El empleado ve saldo, vencimientos y cada movimiento en `/portal/horas`. |
| Respetar **12 h entre jornadas**, **35 h semanales** y el **máximo semanal** | Alertas al detectar horas extra: 12 h entre jornadas, 48 h semanales, 3 h extra diarias y 30 mensuales (Decretos 16.115/33 y 484/00). Avisan; no bloquean. Las 35 h semanales todavía no se controlan solas. |
| Recargos del art. 201 (50 % / 100 %) | Cada hora entra con su recargo: 100 % sábado desde las 13, domingo y feriado; 50 % el resto. |

## Lo que la ley NO dice y el sistema resolvió con el criterio más seguro

- **Saldo al egreso**: se paga con su recargo (el tablero marca a quien tiene un egreso en curso con saldo).
- **Horas no compensadas a tiempo**: si el acuerdo tiene plazo, al vencer se marcan "vencidas: a pagar".
- **Equivalencia**: por defecto *con recargo* (1 h al 50 % → 1 h 30 min de descanso; 1 h al 100 % → 2 h). *Hora por hora* se puede elegir, con advertencia: es el punto más discutido del régimen.
- **Opción de cobro**: el empleado puede pedir cobrar horas del banco en cualquier momento.

**El texto del acuerdo es un modelo.** Revisarlo con el asesor legal y contra el convenio colectivo de la actividad antes de usarlo.

## Circuito

1. **Proponer el acuerdo** (`/banco-horas` → Personas → tildar → *Proponer acuerdo*). Le llega el aviso al empleado.
2. **Aceptación** en el portal, o firma en papel.
3. **Horas extra de la asistencia**: con la asistencia ya clasificada, *Buscar horas extra* propone día por día lo que se quedó después de su horario (de a media hora; menos de 30 min no cuenta; entrar antes no cuenta) y lo trabajado en francos y feriados. Para cada día: **al banco**, **pagar** (novedad `HS_EXTRA_50/100` en el período elegido) o **descartar**. Un día procesado no vuelve a aparecer.
4. **Usar las horas**: el empleado pide un franco o salir antes desde el portal (o RR.HH. lo carga a mano). Lo pedido queda reservado hasta que se resuelve.
5. **Pagar del banco**: salen primero las horas más viejas, y vuelven a horas extra con el recargo con que se generaron.
6. **Anular**: nada se borra; se anula con motivo. Un pago anulado saca su novedad si todavía no se liquidó.

## Datos

- `AcuerdoBancoHoras`: desde/hasta, origen (individual/sindical), tope, plazo en días, equivalencia, aceptación (portal o papel), fin.
- `MovimientoBancoHoras`: tipos `acreditacion`, `compensacion`, `pago`, `ajuste`, `pago_directo` (horas detectadas que se pagaron sin pasar por el banco: no cambian el saldo) y `descarte`. `minutos` = descanso (+/−); `minutosTrabajados` y `recargo` = las horas extra reales.
- Reglas puras: `lib/banco-horas-reglas.ts` (tests en `tests/banco-horas-reglas.test.mjs`). Base de datos: `lib/banco-horas.ts`.

## Permisos y avisos

- Módulo `banco_horas`: RR.HH. completo gestiona; Supervisor y Solo lectura miran (el Supervisor, solo su sector).
- Avisos al empleado: acuerdo propuesto, horas acreditadas, pedido resuelto; recordatorio diario (cron): acuerdo sin responder a los 3 y 10 días, horas que vencen en 30 y en 7 días.
- Mail a RR.HH. cuando un empleado pide usar o cobrar horas (`avisarARRHH`, que ahora también usa el aviso de pedidos de vacaciones).

## Migración

`prisma/migrations/20261012100000_banco_horas` — dos tablas nuevas y el módulo en los roles armados. En producción: `npx prisma migrate deploy` y `npx prisma generate` **antes** de subir el código.
