# 85 · Turnos y horarios de trabajo

## Qué resuelve

Asistencia ya comparaba las fichadas contra un turno para detectar tardanzas
y ausencias, pero los turnos solo se podían cargar por script, uno general
por convenio. Ahora hay una pantalla (**Operaciones → Turnos**) para definir
los horarios de la empresa y asignarlos persona por persona, con turnos
rotativos y turnos noche.

## Cómo se usa

1. **Crear los horarios** de la empresa: "Mañana", "Tarde", "Noche",
   "Administración". Cada uno dice qué días se trabaja y de qué hora a qué
   hora; el día que no se tilda es franco. Si la salida es menor o igual al
   ingreso (22:00 a 06:00), el turno termina al día siguiente.
2. **Asignar**: tildar a las personas en la tabla, elegir el horario y la
   fecha desde la que vale.
   - **Fijo**: un solo horario.
   - **Rotativo**: varios horarios en orden ("+ Rotar con otro"). La semana
     de la fecha "desde" hace el primero; cada lunes pasa al siguiente y, al
     terminar, vuelve a empezar. Hasta 8 semanas.
3. La tabla muestra **quién trabaja cada día** de la semana elegida, con el
   total por día y por horario.

Cambiar el horario de alguien **no borra el anterior**: lo cierra el día
antes. La asistencia de fechas pasadas se sigue leyendo con el horario que
valía entonces.

## Qué ve el empleado

- **Mi horario** en el portal: qué le toca hoy, esta semana y la que viene.
- Un **aviso** cuando le asignan un horario nuevo hacia adelante.
- El jefe ve en **Mi equipo** el turno de hoy de cada persona a cargo.

## Efecto en Asistencia

Al clasificar un día, el horario se busca en este orden:

1. El horario **asignado a la persona** en Turnos.
2. Si no tiene ninguno, el **turno de respaldo** por convenio que estaba
   cargado por script. Para quien todavía no se le asigne nada, **no cambia
   nada**.

Casos nuevos que ahora se resuelven bien:

- **Turno noche**: junta la entrada de un día con la salida del siguiente, y
  no le cuenta esa salida al otro día. Tardanza y salida anticipada se
  calculan igual que de día.
- **Franco por horario en día de semana** (rotaciones con franco un martes):
  figura como franco, no como ausente ni "sin turno".
- Una fichada hasta 4 horas antes del ingreso o después de la salida se toma
  como de ese turno.

La lógica quedó en un solo lugar (`lib/asistencia-jornada.ts`), que usan el
botón "Clasificar" y el script `prisma/clasificar-asistencia.ts`. Antes
estaba copiada en los dos.

## Permisos

- La pantalla es parte del módulo **Asistencia y fichadas**.
- Un usuario **limitado a sectores** asigna horarios a su gente, pero no
  crea ni modifica los horarios de la empresa.

## Feriados

En la misma pantalla, abajo. Se cargan **por empresa y por fecha**.

- El botón **"Cargar los nacionales fijos"** agrega los que no cambian de
  fecha, más Carnaval y Viernes Santo (se calculan desde Pascua).
- Los **trasladables** (17/6, 17/8, 12/10, 20/11) y los **puentes** los fija
  el Gobierno cada año: hay que agregarlos a mano mirando el calendario
  oficial. También se puede sumar el día del gremio o una parada de planta.
- En Asistencia, quien **no ficha un feriado queda como feriado (F)**, no como
  ausente. Si fue a trabajar, se compara contra el horario que le tocaba.
  Esto vale también para quien usa el turno de respaldo por convenio.

## Cambios de un solo día

Tocando una celda de la tabla se cambia **solo ese día de esa persona**:

- **No trabaja (franco)**, o
- **Trabaja en otro horario** (cubre otro turno, entra más tarde). Se puede
  tomar el de un horario existente o escribir las horas.

El cambio se ve con borde punteado, le llega un aviso a la persona, y
Asistencia compara ese día contra el horario del cambio. Prioridad: cambio
del día > feriado > horario habitual.

## Límites conocidos

- **Editar un horario** cambia lo que les toca a todos los que lo tienen,
  también hacia atrás. Si el horario cambió desde una fecha, conviene crear
  uno nuevo y asignarlo desde ese día. La pantalla lo avisa.
- No se borra un horario que alguien tiene o tuvo asignado.
- Un **feriado trabajado** queda como presente o tarde; el pago doble no se
  genera solo: se sigue cargando como novedad.
- Las rotaciones son por **semana completa**; no hay esquemas del tipo 6×2 o
  4×4 (días corridos).
- Si alguien pasa de un turno noche a uno que arranca a la misma hora en que
  termina el anterior, las fichadas de esa mañana pueden quedar mal
  repartidas y hay que revisarlas a mano.

## Técnico

- Tablas `HorarioTrabajo` y `AsignacionHorario` (migración `turnos`).
- Reglas puras en `lib/turnos-reglas.ts` (`tests/turnos-reglas.test.mjs`).
- Tablas `Feriado` y `CambioDeTurno` (migración `feriados_cambios_turno`).
- `GET /api/turnos?semana=`, `POST|DELETE /api/turnos/horarios`,
  `POST /api/turnos/asignaciones`, `GET|POST|DELETE /api/turnos/feriados`,
  `POST /api/turnos/cambios`.

## Instalación

```
npx prisma migrate deploy
npx prisma generate
```
