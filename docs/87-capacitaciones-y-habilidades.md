# 87 · Capacitaciones y matriz de habilidades

Primer módulo del bloque **Desarrollo de talento**. Dos pantallas que
trabajan juntas.

## Matriz de habilidades (Desarrollo de talento → Matriz de habilidades)

Personas en filas, habilidades en columnas. Responde dos preguntas:
**¿quién puede cubrir este puesto?** y **¿qué habilitación se vence?**

- **Habilidades de la empresa**: se cargan una vez, agrupadas (Máquinas,
  Puestos, Seguridad…). Cada una puede tener una **vigencia en meses**
  (autoelevador, trabajo en altura, primeros auxilios) o no vencer.
- **Niveles** (los cuatro clásicos de una matriz de polivalencia):
  1. En formación
  2. Trabaja con supervisión
  3. Autónomo
  4. Puede enseñar
- **Cargar una celda**: tocándola. Sirve para lo que la gente ya sabía antes
  de usar el sistema. Se indica desde cuándo; de ahí sale el vencimiento.
- **Alertas arriba de la matriz**:
  - Habilidades que **dependen de una sola persona, o de nadie**: menos de 2
    personas con nivel autónomo o más y la habilitación vigente.
  - Habilitaciones **vencidas o que vencen en los próximos 60 días**.
- Una habilitación **vencida no cuenta** para cubrir el puesto.

## Capacitaciones (Desarrollo de talento → Capacitaciones)

1. **Programar**: título, tipo, fecha, horas, quién la dicta, y los
   asistentes (uno por uno, o un sector entero). Opcionalmente, **para qué
   habilita** y con qué nivel. Si es a futuro, a los convocados les llega un
   aviso.
2. **Tomar asistencia** el día de la capacitación (se puede guardar parcial).
3. **Cerrar como realizada**. Al cerrar:
   - los presentes **pasan a la matriz** con el nivel que otorga (nunca les
     baja el que ya tenían) y se les **renueva el vencimiento**;
   - cada presente recibe un aviso para **confirmar desde el portal que la
     recibió**. Esa confirmación —con fecha, hora y dirección de origen— es
     la constancia.
4. La pantalla muestra, por capacitación, cuántos confirmaron y quién falta.

También se puede cargar una capacitación **que ya se dio**, para dejar el
registro. Una capacitación cerrada no se modifica.

## Qué ve el empleado

En el portal, **Capacitaciones**: las que tiene que confirmar (con globo en
el inicio), las próximas, **para qué está habilitado** con sus vencimientos,
y su historial.

El jefe ve en **Mi equipo** para qué está habilitado cada uno (autónomo o
más, vigente): es lo que mira para cubrir un puesto.

## Permisos

- Módulo nuevo: **Capacitaciones y habilidades** (bloque Gestión Humana).
- La migración se lo agrega a los roles que vienen armados: RR.HH. completo y
  Supervisor (gestionar), Solo lectura (ver). **A los roles propios hay que
  tildárselo** en Plataforma → Roles y permisos. Los usuarios sin rol
  (operador / lectura) lo reciben según su nivel de siempre.
- Un usuario limitado a sectores carga niveles y capacitaciones de su gente,
  pero no define las habilidades de la empresa. Si una capacitación tiene
  asistentes de otro sector sin marcar, la cierra RR.HH.

## Límites conocidos

- La **vigencia** de cada habilitación la carga la empresa: el sistema no
  trae cargado qué exige cada norma.
- Cambiar la vigencia de una habilidad no recalcula los vencimientos ya
  cargados.
- La constancia es la **confirmación del empleado en el portal**. No se
  genera todavía una planilla en PDF para imprimir y firmar a mano.
- No hay recordatorio automático de vencimientos (se ven en la matriz y en el
  portal).
- No se adjunta material (PDF, video) ni hay evaluación de lo aprendido.

## Técnico

- Tablas `Habilidad`, `HabilidadLegajo`, `Capacitacion`,
  `AsistenteCapacitacion` (migración `capacitaciones`, que además agrega el
  módulo a los roles predefinidos).
- Reglas puras en `lib/capacitaciones-reglas.ts`
  (`tests/capacitaciones-reglas.test.mjs`).
- `/api/habilidades`, `/api/habilidades/celda`, `/api/capacitaciones`,
  `/api/capacitaciones/[id]`, `/api/portal/capacitaciones/[id]`.

## Instalación

```
npx prisma migrate deploy
npx prisma generate
```
