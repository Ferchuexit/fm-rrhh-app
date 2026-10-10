# 82 · Planificación de vacaciones: gente afuera y costo entre fechas

Para decidir un pedido de vacaciones RR.HH. necesita dos datos: **cuánta
gente queda afuera a la vez** y **si el rango entra en el presupuesto
aprobado**. Los dos están en `/vacaciones`.

## Planificación entre fechas

Se elige desde, hasta y (opcional) centro de costo.

- **Dotación**: personas activas del filtro.
- **Máximo afuera a la vez**: el peor día del rango, y desde cuándo.
- **Días de vacaciones** que caen dentro del rango (aprobados y sin responder).
- **Costo laboral del rango**: bruto + contribuciones patronales, con todos
  trabajando.
- **Vacaciones del rango**: lo que cuestan esos días (sueldo ÷ 25, LCT
  art. 155).
- **Total con vacaciones**: costo laboral + plus vacacional (la diferencia
  entre pagar el día a sueldo ÷ 25 y a sueldo ÷ 30). Es el número que se
  compara contra el **presupuesto**.
- **Ya liquidado**: para fechas pasadas, lo real de los períodos cerrados que
  tocan el rango.

La casilla "Contar también los pedidos sin responder" muestra cómo queda el
rango **si se aprueba todo lo pendiente**; destildada, solo lo ya aprobado.

### Presupuestos guardados

El presupuesto se guarda **por empresa, rango de fechas y (opcional) centro
de costo**. Uno solo por combinación: guardar de nuevo lo reemplaza. Queda
registrado quién lo cargó. Se expresa en **costo laboral** (bruto +
contribuciones).

En **Solicitudes**, cada pedido de vacaciones pendiente muestra los
presupuestos que le corresponden (por fechas y por sector): cuánto va usado
hoy con lo ya aprobado, cuánto quedaría aprobando ese pedido, y si entra o
se pasa. Cada pedido se evalúa **por separado**: si hay varios pendientes,
el efecto de aprobarlos todos se ve en la planificación con la casilla
tildada.

### De dónde salen los importes

De las últimas liquidaciones **cerradas** de cada persona, llevadas a 30 días
(un mes, o dos quincenas).

Contribuciones patronales, en este orden:

1. Las que **calculó la liquidación** (conceptos de tipo contribución
   patronal: SIPA, obra social, ART, seguro de vida, según las reglas
   cargadas).
2. Si la liquidación no las calcula: el **% sobre el bruto** que se cargue
   para la empresa en la misma pantalla.
3. Si no hay ninguna de las dos: el costo queda solo en bruto y la pantalla
   **lo avisa** — no se asume ningún porcentaje por defecto.

Es una **estimación**: si el último período tuvo SAC, horas extra o un
ajuste, lo arrastra. No incluye boletas sindicales ni seguros que no estén
cargados como concepto. Quien no tiene liquidaciones cerradas no entra en
los importes y la pantalla avisa cuántos son.

### Quién ve los importes

Solo quien tiene acceso a **Liquidaciones** (o el administrador): importes,
presupuestos y el % de contribuciones. Un rol Supervisor ve gente afuera y
días, sin importes.

## Gantt

- Fila nueva **"Gente afuera por semana"**: el máximo de personas afuera el
  mismo día de cada semana, con color según el % de la dotación (verde <15%,
  naranja ≥15%, rojo ≥30%).
- Los **pedidos sin responder** se dibujan rayados en naranja.
- Encabezado con los meses y total de personas del filtro.
- Corrección: las vacaciones que cruzan de diciembre a enero no aparecían en
  ningún año; ahora aparecen en los dos.

## Solicitudes

Cada pedido de vacaciones pendiente muestra, para el sector de la persona:
cuántos hay afuera hoy en esas fechas, cuántos habría aprobando el pedido,
el estado de los presupuestos que le corresponden y un enlace a la
planificación con las fechas ya cargadas.

## Técnico

- Cuentas puras en `lib/planificacion-reglas.ts`
  (`tests/planificacion-reglas.test.mjs`); consultas en `lib/planificacion.ts`.
- `GET /api/vacaciones/planificacion?desde&hasta&centroCostoId`.
- `GET/POST/DELETE /api/vacaciones/presupuestos`.
- Migración `presupuesto_salarial`: tabla `PresupuestoSalarial` y columna
  `empresas.pctContribucionesEstimado`.
