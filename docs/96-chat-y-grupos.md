# 96 — Comunicación interna: chat y grupos

Módulo de permisos `chat` (Comunicación interna → Chat y grupos). El
empleado lo usa desde el portal (botón **Chat** en la barra de abajo).

## Tres tipos de conversación

| Tipo | Quiénes | Lo ve RR.HH. |
|---|---|---|
| **Grupo** | Lo arma RR.HH.: toda la empresa, uno o más sectores, y/o personas agregadas a mano | Sí, y escribe como "RR.HH. · Nombre" |
| **Consulta a RR.HH.** | Un empleado con el área (una por persona) | Sí: es una bandeja compartida, responde cualquiera con el módulo |
| **Directo** | Dos compañeros | **No.** No aparece en el panel |

- **Grupos por sector**: la gente entra y sale sola cuando cambia de
  sector, ingresa o se va. No hay que mantener listas.
- **Grupo de anuncios**: solo escriben RR.HH. y los *encargados* (personas
  agregadas a mano y marcadas como tales); el resto lee.
- **Archivar** un grupo lo saca de la vista de los empleados sin perder el
  historial.
- **Mensajes entre compañeros**: se pueden desactivar para toda la empresa
  con un tilde. Lo ya escrito se sigue leyendo, pero no se puede escribir.
- Los empleados no crean grupos (por ahora): evita que se llene de grupos
  que nadie modera.

## Mensajes

- Solo texto, hasta 2.000 caracteres. (Fotos y archivos: pendiente.)
- Cada uno puede borrar sus mensajes; RR.HH. puede sacar cualquier mensaje
  de un grupo o de una consulta. Queda "Mensaje eliminado".
- **No es instantáneo al milisegundo**: con una conversación abierta, la
  pantalla pide los mensajes nuevos cada 4 segundos (la lista, cada 15).
  Vercel no mantiene conexiones abiertas; para una fábrica alcanza y no
  suma ningún servicio pago. Si algún día hace falta tiempo real de verdad,
  se cambia el transporte sin tocar el resto.
- **Notificación al celular** (sin mail) cuando llega un mensaje, sin el
  texto (se lee con el celular bloqueado). Para no saturar: si la persona
  ya tiene mensajes sin leer en esa conversación, no se le manda otra.
- Cuando un empleado le escribe a RR.HH. **no** sale notificación a RR.HH.:
  se ve el contador en Chat y grupos. (Pendiente: sumarlo al mail semanal o
  avisar por mail.)

## Alcance

Un usuario limitado a sectores que tenga el módulo ve solo las consultas de
su gente, y no crea, edita ni archiva grupos ni cambia la configuración. El
rol Supervisor no trae el módulo.

## Código

`lib/chat-reglas.ts` (puro, `tests/chat-reglas.test.mjs`), `lib/chat.ts`,
`app/chat`, `app/api/chat`, `app/portal/chat`, `app/api/portal/chat`.
Tablas `Conversacion`, `MiembroConversacion`, `MensajeChat`;
`Empresa.chatEntreEmpleados`.

En la barra de abajo del portal, **Chat reemplazó a Legajo** (que sigue en
el inicio): cinco botones es lo que entra cómodo en un celular.
