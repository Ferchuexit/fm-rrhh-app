# 90 · Recordatorios automáticos

## Qué resuelve

Hasta ahora el sistema avisaba **cuando pasaba algo** (te cargaron un
objetivo, salió tu recibo). Si la persona no lo hacía, nadie se lo volvía a
decir. Ahora una tarea corre **todos los días a las 9** y recuerda lo que
quedó pendiente.

## Qué recuerda

Al empleado o al jefe (notificación en el celular + mail, como cualquier
aviso; solo a quien tiene acceso al portal):

| Qué | Cuándo |
| --- | --- |
| Jefe con evaluaciones de su equipo sin completar | 3 días antes del límite, el día, y una vez por semana si se venció |
| Autoevaluación sin hacer | igual |
| Evaluación entregada sin firmar | a los 3 días y después una vez por semana, hasta un mes |
| Objetivo que vence | 7 días antes y el día |
| Capacitación | el día anterior, a los convocados |
| Capacitación realizada sin confirmar | a los 3 días y después una vez por semana, hasta un mes |
| Habilitación que vence (autoelevador, altura…) | 30 y 7 días antes |
| Recibos de los últimos 3 meses sin firmar | los lunes |

A **RR.HH.**, un **mail los lunes** por empresa con lo pendiente: pedidos
de vacaciones sin responder, evaluaciones vencidas o sin entregar, objetivos
vencidos, habilitaciones vencidas o por vencer, capacitaciones sin cerrar y
recibos sin firmar. Si no hay nada pendiente, no llega. Lo reciben los
usuarios de esa empresa que gestionan algo de Gestión Humana y no están
limitados a sectores; si no hay ninguno, los administradores.

Criterio: **pocos y espaciados**. Ningún recordatorio se repite todos los
días, y ninguno lleva datos sensibles (se leen con el celular bloqueado).

## Cómo activarlo (una sola vez)

En Vercel → el proyecto → **Settings → Environment Variables**, agregar:

- `CRON_SECRET` = un texto largo cualquiera, de 32 caracteres o más
  (letras y números). Es la clave con la que Vercel llama a la tarea.

Después, **volver a desplegar** (Deployments → Redeploy, o cualquier push).
Sin esa variable la tarea no corre: es a propósito, para que nadie pueda
dispararla desde afuera.

Para confirmar que anda: **Accesos al portal → Avisos enviados** muestra
cuándo corrió por última vez y cuántos recordatorios salieron. En Vercel,
la pestaña **Cron Jobs** (Settings) muestra la tarea y permite correrla a
mano.

## Técnico

- `vercel.json`: `0 12 * * *` (12:00 UTC = 9:00 de Argentina). En el plan
  gratuito de Vercel la hora es aproximada (dentro de esa hora).
- `/api/cron/recordatorios`: sin sesión, exige `Authorization: Bearer
  $CRON_SECRET`. Corre **una vez por día** (tabla `EjecucionRecordatorios`);
  una segunda llamada el mismo día no manda nada. `?forzar=1` la repite.
- Cuándo toca cada cosa y los textos: `lib/recordatorios-reglas.ts`
  (`tests/recordatorios-reglas.test.mjs`). Las consultas:
  `lib/recordatorios.ts`. Cada recordatorio va en su propio bloque: si uno
  falla, los demás salen.
- En local no corre sola. Para probar:
  `curl -H "Authorization: Bearer <clave>" "http://localhost:3000/api/cron/recordatorios?forzar=1&fecha=2026-10-12"`
  (`fecha` solo funciona fuera de producción). **Ojo:** el localhost usa la
  misma base que producción, así que eso manda avisos reales.

## Instalación

Trae migración (`recordatorios`):

```
npx prisma migrate deploy
npx prisma generate
```
