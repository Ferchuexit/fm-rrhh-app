# 83 · Alcance por sector

## Qué resuelve

Un usuario del panel puede quedar **limitado a ciertos centros de costo** de
una empresa: un supervisor de Taller con usuario del sistema ve y gestiona
solo a la gente de Taller.

Complementa a los roles (doc 80): el **rol** dice qué módulos puede usar; el
**alcance** dice sobre qué personas.

## Cómo se configura

**Usuarios → Ver / asignar**: en cada empresa, además del rol, se tildan los
**sectores**. Ninguno tildado = ve toda la empresa (como hasta ahora).

Un mismo usuario puede estar limitado en una empresa y no en otra.

## Qué cambia para un usuario limitado

- En todas las pantallas ve **solo legajos de sus sectores**, y lo que
  cuelga de ellos: vacaciones, solicitudes, Gantt y planificación,
  asistencia y fichadas, legajo digital, accesos al portal, documentos.
- No puede modificar ni cargar nada de alguien de otro sector, aunque
  conozca la dirección o el id.
- Los desplegables de centro de costo le muestran solo los suyos.
- **Noticias**: lee las generales y las de sus sectores; publica, archiva o
  borra solo las de sus sectores (no puede publicar a toda la empresa).
- Cosas de toda la empresa (cerrar un período de asistencia, terminales de
  fichada): las ve, no las modifica.
- Los legajos **sin centro de costo** no los ve: conviene asignarle sector a
  todos.

## Requiere un rol de Gestión Humana

Los sectores solo se pueden combinar con un rol que tenga módulos de Gestión
Humana y, como mucho, **Legajos en "ver"** (por ejemplo, Supervisor). El
sistema rechaza:

- asignar sectores a un usuario sin rol, o con un rol que incluya
  liquidación, reportes o configuración;
- editar un rol para sumarle esos módulos mientras lo tenga alguien limitado.

Motivo: el filtro cubre los datos de personas, pero no los totales de una
liquidación ni los reportes de toda la empresa. Con esta regla esas pantallas
directamente no le aparecen.

## Cómo está hecho

El filtro vive en **un solo lugar**, el cliente de base de datos
(`lib/alcance.ts`), no ruta por ruta. Cada consulta sobre legajos, o sobre
cualquier tabla que tenga un legajo dueño, recibe la condición "el legajo es
de mis sectores" antes de ejecutarse.

- Qué tablas son "de personas" **se deduce del esquema**: una tabla nueva con
  `legajo Legajo` queda filtrada sola. `tests/alcance-reglas.test.mjs` falla
  si aparece una tabla con `legajoId` que no quede cubierta.
- Las reglas (qué se filtra, qué se niega) son funciones puras en
  `lib/alcance-reglas.ts`.
- El portal del empleado y la terminal de fichadas no pasan por el filtro:
  ahí no hay un usuario del panel.
- El administrador nunca está limitado.
- Un cambio de sectores tarda **hasta 10 segundos** en aplicarse.

### Límites conocidos

- No filtra datos anidados pedidos desde una tabla que no es de personas
  (por ejemplo, un período con sus liquidaciones) ni SQL directo. Hoy eso
  solo ocurre en pantallas de liquidación, a las que un usuario limitado no
  entra por la regla del rol. Si se agrega una pantalla de Gestión Humana
  que consulte así, hay que filtrarla a mano con
  `sectoresDelUsuarioActual()` de `lib/prisma.ts`.
- El alcance es por **centro de costo**, no por sucursal.

## Instalación

Trae migración (`alcance_sector`: columna `sectores` en `UsuarioEmpresa`):

```
npx prisma migrate deploy
npx prisma generate
```
