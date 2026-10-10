# 82 · Planificación de vacaciones: gente afuera y costo entre fechas

Para decidir un pedido de vacaciones RR.HH. necesita dos datos: **cuánta
gente queda afuera a la vez** y **si el rango entra en el presupuesto
aprobado**. Los dos están en `/vacaciones`.

## Planificación entre fechas

Se elige desde, hasta y (opcional) centro de costo.

- **Dotación**: personas activas del filtro.
- **Máximo afuera a la vez**: el peor día del rango, y desde cuándo.
- **Días de vacaciones** que caen dentro del rango (aprobados y sin responder).
- **Masa salarial del rango**: lo que se pagaría con todos trabajando.
- **Vacaciones del rango**: lo que se paga por esos días (sueldo ÷ 25, LCT
  art. 155).
- **Total con vacaciones**: masa + plus vacacional (la diferencia entre pagar
  el día a sueldo ÷ 25 y a sueldo ÷ 30). Es el número que se compara contra
  el **presupuesto**.
- **Ya liquidado**: para fechas pasadas, el bruto real de los períodos
  cerrados que tocan el rango.

La casilla "Contar también los pedidos sin responder" muestra cómo queda el
rango **si se aprueba todo lo pendiente**; destildada, solo lo ya aprobado.

El presupuesto se escribe en la pantalla y queda recordado en ese navegador.
No se guarda en el sistema.

### De dónde sale el sueldo

De las últimas liquidaciones **cerradas** de cada persona, llevadas a 30 días
(un mes, o dos quincenas). Es una **estimación**: bruto, sin contribuciones
patronales; si el último período tuvo SAC, horas extra o un ajuste, el
estimado lo arrastra. Quien no tiene liquidaciones cerradas no entra en los
importes y la pantalla avisa cuántos son.

### Quién ve los importes

Solo quien tiene acceso a **Liquidaciones** (o el administrador). Un rol
Supervisor ve gente afuera y días, sin importes.

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
cuántos hay afuera hoy en esas fechas, cuántos habría aprobando el pedido, y
un enlace a la planificación con las fechas ya cargadas.

## Técnico

- Cuentas puras en `lib/planificacion-reglas.ts`
  (`tests/planificacion-reglas.test.mjs`); consultas en `lib/planificacion.ts`.
- `GET /api/vacaciones/planificacion?desde&hasta&centroCostoId`.
- Sin migración.
