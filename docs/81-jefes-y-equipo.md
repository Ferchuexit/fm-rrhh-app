# 81 · Jefes y equipo: quién pide las vacaciones (Parte B)

## La regla

Las vacaciones las **solicita el jefe**, que es quien conoce y coordina la
producción, y **RR.HH. aprueba o rechaza** (por ejemplo, si dirección pidió
no exceder cierto presupuesto en un rango de fechas).

| Quién | Qué puede pedir desde el portal |
| --- | --- |
| Empleado **con** jefe cargado | Solo **permisos**. En vacaciones ve: "las pide tu jefe, Fulano" |
| Empleado **sin** jefe cargado | Vacaciones y permisos propios, como antes |
| Jefe (tiene gente que le reporta) | **Vacaciones** para su equipo, desde "Mi equipo". Sus propias vacaciones las pide su jefe; si no tiene, él mismo |

RR.HH. sigue pudiendo cargar una vacación a mano en `/vacaciones` para
cualquiera (por ejemplo, si el jefe no usa el portal).

## Cómo se arma la jerarquía

En el legajo, **Datos laborales → Reporta a (jefe directo)**. Se elige otro
legajo activo de la misma empresa. El sistema rechaza los círculos (A reporta
a B y B reporta a A).

No hay nada más que configurar: en cuanto alguien tiene al menos una persona
a cargo, le aparece **"Mi equipo"** en el portal.

## Qué ve el jefe en "Mi equipo"

- Cada persona a cargo **directo**: días disponibles del año y próximas
  vacaciones ya aprobadas.
- El formulario para pedir vacaciones para alguien del equipo.
- Los pedidos del equipo y su estado. De los **permisos que pidió la propia
  persona** ve fechas y estado, **no el motivo** (es entre el empleado y
  RR.HH.).
- Puede cancelar un pedido que él cargó mientras siga pendiente.

Un gerente ve solo a quienes le reportan directo, no a la gente de sus jefes.

## Qué ve RR.HH.

En **Solicitudes**, cada pedido dice quién lo cargó ("por su jefe, Fulano" o
"por el propio empleado"). Aprobar y rechazar funcionan igual que antes: al
aprobar se registra la vacación en `/vacaciones`. La respuesta de RR.HH. la
lee quien hizo el pedido.

## Detalles técnicos

- `Legajo.jefeId` (auto-relación) y `SolicitudAusencia.solicitadoPorId`.
- Reglas puras en `lib/equipo-reglas.ts` (tests en
  `tests/equipo-reglas.test.mjs`); acceso a datos en `lib/equipo.ts`.
- `/api/portal/solicitudes` verifica **en la base** que `paraLegajoId` reporte
  directo a quien está logueado; no confía en el navegador.
- Los pedidos de vacaciones que un empleado ya había hecho antes de tener
  jefe cargado siguen pendientes y RR.HH. los responde normalmente.

## Instalación

Trae migración (`jefes_equipo`):

```
npx prisma migrate deploy
npx prisma generate
```

## Pendiente

- Alcance por sector para usuarios del **panel** (que un supervisor con
  usuario del sistema vea solo su sector).
- Avisos al jefe y al empleado cuando RR.HH. responde (WhatsApp / mail).
- Tope de presupuesto o de ausentes simultáneos por sector como ayuda para la
  decisión de RR.HH.
