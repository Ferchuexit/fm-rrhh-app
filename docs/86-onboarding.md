# 86 · Onboarding (ingreso de personal)

## Qué resuelve

Cada vez que entra alguien hay una lista de cosas que hacer, repartidas entre
RR.HH., el jefe y el propio empleado, y casi siempre vive en la cabeza de
alguien o en un papel. Onboarding la pone en el sistema: quién hace qué,
para cuándo, y cómo viene cada ingreso.

Pantalla: **Gestión de RR.HH. → Onboarding**.

## Cómo se usa

1. **Cargar el legajo** del empleado nuevo (con su fecha de ingreso).
2. En Onboarding, **Iniciar un ingreso**: elegir a la persona y una
   plantilla. La pantalla sugiere a quienes ingresaron en los últimos 45
   días (o están por ingresar) y todavía no tienen plan.
3. Se crean las tareas con su vencimiento, calculado desde la fecha de
   ingreso, y se le **avisa** al empleado y a su jefe (si tienen acceso al
   portal).
4. Cada uno tilda lo suyo:
   - **RR.HH.**, en esta pantalla. Puede tildar cualquier tarea, o marcarla
     "No aplica".
   - **El jefe**, en el portal, en **Mi equipo**.
   - **El empleado**, en el portal, en **Mi ingreso**. Ve lo que tiene que
     hacer él y, para saber qué esperar, lo que va a hacer la empresa.
5. Cuando no queda nada pendiente, el ingreso se cierra solo como completo.

Cada ingreso muestra el avance y cuántas tareas están **vencidas y de
quién**.

## Tareas que se tildan solas

Si la tarea es algo que el sistema puede comprobar con sus propios datos, no
hace falta tildarla: se marca sola ("hecha por el sistema") cuando se cumple.

| Comprobación | Se cumple cuando… |
| --- | --- |
| Jefe | el legajo tiene cargado a quién reporta |
| Horario | tiene un horario asignado en Turnos |
| Acceso al portal | se le generó el acceso |
| PIN propio | entró al portal y eligió su PIN |
| Legajo (empleado) | no le queda nada por subir ni firmar |
| Legajo completo | el legajo digital está completo |
| CBU | está cargado en el legajo |
| Obra social | está cargada en el legajo |

Se revisan cada vez que alguien abre una pantalla de onboarding. RR.HH.
puede tildarlas a mano igual; el jefe y el empleado, no.

## Plantillas

- La primera vez se crea sola **"Ingreso general"**, con 18 tareas pensadas
  para una planta (alta temprana, preocupacional, ropa y EPP, inducción de
  seguridad, legajo, seguimiento al mes, evaluación antes del fin del período
  de prueba). **Es un punto de partida: hay que revisarla** y adaptarla a
  cada empresa. En particular, el día de la evaluación del período de prueba
  viene en 150 y depende del período que le corresponda a la empresa.
- Se puede tener una por tipo de puesto (operarios, administración,
  choferes): **Copiar** una y editarla.
- Cada tarea tiene: día respecto del ingreso (0 = el día que entra; −2 = dos
  días antes; 30 = al mes), quién la hace, y si se comprueba sola.
- **Cambiar una plantilla no modifica los ingresos en curso**: cada ingreso
  lleva su propia copia de las tareas.

## Permisos

- La pantalla es parte del módulo **Legajo digital**.
- Un usuario limitado a sectores inicia y sigue ingresos de su gente, pero
  no edita las plantillas de la empresa.
- En el portal, cada uno tilda solo lo suyo: el empleado sus tareas, el jefe
  las tareas de jefe de quien le reporta directo. Se verifica en el servidor.

## Límites conocidos

- Los vencimientos se fijan al iniciar: si después se corrige la fecha de
  ingreso del legajo, hay que cancelar el ingreso e iniciarlo de nuevo.
- No hay recordatorios automáticos de tareas vencidas (se ven en pantalla).
- No hay offboarding (egreso) todavía.

## Técnico

- Tablas `PlantillaIngreso`, `Ingreso`, `TareaIngreso` (migración
  `onboarding`).
- Reglas puras en `lib/ingresos-reglas.ts` (`tests/ingresos-reglas.test.mjs`);
  datos y comprobaciones automáticas en `lib/ingresos.ts` (`ponerAlDia`).

## Instalación

```
npx prisma migrate deploy
npx prisma generate
```
