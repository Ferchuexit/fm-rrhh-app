# FM RRHH — Portal del Empleado: vacaciones y permisos (v1)

Vuelta 76. Segunda pieza del portal (la primera: `75-portal-empleado.md`).
El empleado ve su saldo de vacaciones y pide vacaciones o un permiso desde
el celular; RR.HH. aprueba o rechaza desde una bandeja.

## Qué hay

| Quién | Dónde | Qué hace |
|---|---|---|
| Empleado | `/portal/vacaciones` | Ve su saldo del año, sus próximas vacaciones, hace un pedido, sigue el estado y lee la respuesta; puede cancelar mientras esté pendiente |
| RR.HH. | `/solicitudes` | Bandeja de pendientes con el saldo de cada uno; aprueba o rechaza (rechazar exige motivo) |

## Un pedido no es una vacación — hasta que se aprueba

`SolicitudAusencia` es solo la bandeja de entrada. Al **aprobar vacaciones**
se crea la `Vacacion` de siempre, en la misma transacción: desde ahí aparece
en `/vacaciones` (Gantt, pendientes, notificación en PDF) como si se hubiera
cargado a mano. `/vacaciones` sigue siendo la única fuente de verdad; no hay
dos lugares que puedan decir cosas distintas.

Aprobar un **permiso** solo deja la constancia. No escribe en la grilla de
asistencia: qué código corresponde (con o sin goce, etc.) lo decide RR.HH.
en `/asistencia`. No se inventó una equivalencia.

## El saldo

Mismo cálculo que `/api/vacaciones/pendientes` (tramos del art. 150 LCT,
antigüedad al 31/12, antigüedad reconocida si está cargada), menos lo
registrado para ese año y menos lo que el empleado ya tiene pedido sin
responder — si no, podría pedir dos veces los mismos días. Vive en
`lib/ausencias.ts` y lo usan las dos puntas (portal y bandeja).

## Lo que se valida al pedir (`lib/ausencias-reglas.ts`, con tests)

- No se pide para atrás. "Hoy" es el de Argentina, no el del servidor.
- Vacaciones: no más días que el saldo disponible del año de inicio.
- Permiso: motivo obligatorio; no consume saldo de vacaciones.
- No se pisan fechas con otro pedido vivo ni con vacaciones ya registradas
  (el mensaje dice con cuál choca).
- Tope de 60 días por pedido.

Al aprobar se vuelve a chequear la superposición (entre el pedido y la
aprobación alguien pudo cargar una vacación a mano), y si dos personas
aprueban a la vez, solo una gana: no se crea una vacación doble.

## Cómo aplicar esto

```bash
npx prisma migrate deploy     # crea SolicitudAusencia — no toca datos existentes
```

## Cómo probarlo

1. En `/portal` → pestaña "Vacaciones y permisos": pedí una semana.
2. En `/solicitudes` debería estar como pendiente, con el saldo. Aprobala.
3. En `/vacaciones` aparece registrada; en el portal, como "Aprobado".

## Qué falta

- **Empleados con menos de 6 meses**: la LCT (art. 151/153) les da 1 día
  cada 20 trabajados, no los 14 del tramo. El cálculo heredado de
  `lib/vacaciones.ts` no lo contempla, así que a un ingresante el portal le
  muestra 14. Corregirlo cambia también `/vacaciones` — es su propia vuelta.
- **Saldo de años anteriores** no gozados: solo se muestra el año en curso.
- **Aprobación por el jefe directo**: hoy aprueba cualquier usuario con
  acceso a la empresa; no hay todavía una jerarquía de quién aprueba a quién.
- **Aviso al empleado** cuando le responden (hoy lo ve al entrar).
- **Volcar el permiso aprobado a la grilla de asistencia** con su código.
- **Sincronizar la vacación aprobada con asistencia**: sigue siendo el
  script `prisma/sincronizar-vacaciones-asistencia.ts`, igual que antes.
