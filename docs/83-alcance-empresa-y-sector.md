# 83 · Alcance: por empresa y por sector

Dos límites sobre qué datos toca cada usuario del panel, uno adentro del
otro. Los dos se aplican en el mismo lugar (ver "Cómo está hecho").

## 1. Por empresa (siempre, para todo el que no es administrador)

Un usuario solo llega a datos de **las empresas que tiene asignadas**:
legajos y todo lo que cuelga de ellos, períodos, liquidaciones, sectores,
noticias, terminales, presupuestos. Vale para leer, modificar y dar de alta,
y vale aunque conozca el identificador de un dato ajeno o cambie a mano la
empresa seleccionada.

No hay nada que configurar: sale de las empresas tildadas en **Usuarios**.

Por qué existe: antes cada ruta tenía que acordarse de verificar la empresa,
y varias no lo hacían (por ejemplo, guardar un legajo). Hoy la verificación
no depende de cada ruta.

## 2. Por sector (opcional)

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
- Lo mismo para lo que es **de una empresa** (tablas con `empresaId`, y lo
  que cuelga de ellas a un salto). Las tablas generales —convenios, escalas,
  conceptos, reglas— son compartidas y no se filtran.
- El administrador nunca está limitado.
- Un cambio de empresas o sectores tarda **hasta 10 segundos** en aplicarse.
- Si algo queda fuera de alcance, la consulta devuelve "no encontrado" o el
  error "Eso está fuera de las empresas o sectores que tenés asignados".

### Límites conocidos

- **Por empresa**: no filtra datos anidados pedidos desde una tabla
  *general* (por ejemplo, un convenio con todos sus legajos) ni SQL directo.
  Hoy ninguna pantalla consulta así; si se agrega una, hay que filtrarla a
  mano.
- **Por sector**: además, no filtra datos anidados pedidos desde una tabla
  de la empresa (por ejemplo, un período con sus liquidaciones). Eso solo
  ocurre en pantallas de liquidación, a las que un usuario limitado a
  sectores no entra por la regla del rol. Para una pantalla nueva de Gestión
  Humana que consulte así: `sectoresDelUsuarioActual()` de `lib/prisma.ts`.
- El historial de ediciones de una liquidación (`LiquidacionDetalleEdicion`)
  queda a tres saltos del legajo y no se filtra solo; hoy se lee siempre
  desde su liquidación, que sí está filtrada.
- El alcance es por **centro de costo**, no por sucursal.

## Instalación

Trae migración (`alcance_sector`: columna `sectores` en `UsuarioEmpresa`):

```
npx prisma migrate deploy
npx prisma generate
```
