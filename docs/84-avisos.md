# 84 · Avisos a los empleados (notificación en el celular y mail)

## Qué hace

El sistema le avisa solo al empleado cuando pasa algo que le importa, sin
que tenga que entrar al portal a fijarse.

| Qué pasó | A quién le llega |
| --- | --- |
| Se cerró un período: hay recibo para firmar | A cada empleado con recibo sin firmar |
| RR.HH. respondió un pedido de vacaciones o permiso | A quien lo cargó (el jefe o el empleado) |
| RR.HH. aprobó vacaciones que pidió el jefe | Además, al empleado |
| El jefe cargó vacaciones para alguien | A ese empleado ("falta que RR.HH. apruebe") |
| Se publicó una noticia | A los destinatarios (toda la empresa o el sector) |
| RR.HH. rechazó un documento del legajo | Al empleado: tiene que subirlo de nuevo |
| RR.HH. respondió un pedido de cambio de datos | Al empleado |
| Entró un pedido nuevo de vacaciones o permiso | **A RR.HH., por mail** (ver abajo) |

Solo se le avisa a quien tiene **acceso al portal activo**: el aviso lleva a
una pantalla del portal.

## Los dos canales

**Notificación en el celular.** Aparece como la de cualquier app, aunque el
portal esté cerrado. Cada empleado la activa una vez, en cada celular, desde
el inicio del portal ("Activar avisos"). Puede mandarse una de prueba y
desactivarla cuando quiera.

- Android: funciona en Chrome, Samsung Internet, Edge y Firefox.
- iPhone: primero hay que **agregar el portal a la pantalla de inicio**
  (Compartir → Agregar a inicio) y abrirlo desde ese ícono. El portal lo
  explica cuando detecta un iPhone. Requiere iOS 16.4 o posterior.

**Mail.** Sale a quien tenga mail cargado en el legajo. Usa el mismo
servicio (Resend) que los reportes.

Los dos canales salen a la vez: quien tiene los dos, recibe los dos.

## Privacidad

Una notificación se lee con el celular bloqueado, a la vista de cualquiera.
Por eso ningún aviso lleva importes, el motivo de un permiso, el texto de un
rechazo ni el nombre de un documento (puede ser un certificado médico). Dice
qué pasó y manda a abrir el portal, donde se entra con PIN.

## Aviso a RR.HH.

Cuando entra un pedido, le llega un mail a los usuarios del panel que pueden
responderlo en esa empresa: los que tienen **Vacaciones en "gestionar"** y,
si están limitados a sectores, solo si el sector es el de la persona. Si la
empresa no tiene ningún usuario así, les llega a los administradores.

## Registro

Cada aviso queda en la tabla `Aviso`: a quién, qué decía, a cuántos
celulares llegó y si salió el mail. Un aviso con todo en cero significa que
la persona no tenía avisos activados ni mail cargado.

Se consulta en **Plataforma → Avisos enviados**: quién tiene acceso al
portal, quién activó los avisos en el celular, quién tiene mail, y los
últimos 200 avisos con su resultado. Si al servidor le faltan las llaves de
las notificaciones o la clave del mail, la pantalla lo dice arriba.

## Qué hay que configurar

En `.env.local` y en Vercel (Settings → Environment Variables):

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

Se generan **una sola vez** con:

```
npx web-push generate-vapid-keys
```

- Hay que usar **las mismas** en la computadora y en Vercel.
- **No cambiarlas después**: si cambian, todos los celulares tienen que
  activar los avisos de nuevo.
- La privada es secreta: no va al repositorio.
- Sin estas variables el portal simplemente no ofrece activar avisos.

Para el mail: `RESEND_API_KEY` y `EMAIL_REMITENTE` (ver `lib/email.ts`). Con
el remitente de prueba de Resend los mails solo llegan a la casilla con la
que se abrió la cuenta: para mandarle a los empleados hay que **verificar un
dominio propio** en Resend.

## Cómo está hecho

- `lib/avisos-reglas.ts`: el texto de cada aviso y la validación de la
  dirección del servicio de notificaciones (funciones puras, con tests).
- `lib/avisos.ts`: `avisar(legajoIds, aviso)`. **Nunca hace fallar** la
  acción que lo dispara: si no sale, el período igual queda cerrado.
- `public/portal/sw.js`: lo que corre en el celular para mostrar el aviso.
- `public/portal/app.webmanifest` + íconos: lo que deja instalar el portal.
- `app/portal/AvisosCelular.tsx` y `/api/portal/push`: activar / desactivar.
- Una suscripción que el servicio informa vencida (el empleado desinstaló o
  bloqueó) se borra sola.
- Dependencia nueva: `web-push` (hay que correr `npm install`).

## Instalación

```
npm install
npx prisma migrate deploy
npx prisma generate
```

## Pendiente

- Recordatorios (recibo sin firmar después de N días, acuse pendiente).
- Elegir por empresa qué eventos avisan.
- WhatsApp.
