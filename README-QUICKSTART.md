# FM RRHH — Sistema de liquidación (Postgres real desde la vuelta 30)

## Requisitos

- Node.js (18 o más nuevo).
- Un Postgres al que conectarte — instalado en tu PC, en Docker, o alojado
  (Neon/Supabase/Railway, gratis para este uso). Ver las tres opciones
  comentadas en `.env.example`, y el detalle completo en `30-migracion-postgres.md`.

## Pasos, en orden

```bash
cd fm-rrhh-app
npm install
cp .env.example .env
# editar .env: pegar tu DATABASE_URL real (y opcionalmente un AUTH_SECRET propio)
npx prisma migrate dev --name init
npm run dev
```

El `migrate dev` crea todas las tablas en tu Postgres y corre el seed
automáticamente (5 legajos, conceptos numerados, parámetros vigentes, un
usuario de login).

Abrí **http://localhost:3000** — te va a pedir login
(`fernando@fmconsultora.com` / `cambiar123`, del seed).

## Qué vas a ver

1. `/login` primero — sin sesión válida, no se entra a nada más.
2. La home, con los módulos como tarjetas (los que tu rol pueda ver).
3. `/legajos` — la lista de los 5 legajos del seed, **leída de Postgres real**.
4. Un botón para liquidar el período, que dispara `/api/liquidar` de verdad:
   - Lee las escalas y reglas vigentes de la base.
   - Llama a `liquidarLegajo()` — el mismo motor de reglas de siempre, la
     misma función que ya probamos en `test-motor-reglas.mjs`, sin tocarle
     una línea.
   - Guarda el resultado (`Liquidacion` + `LiquidacionDetalle`) en Postgres.
   - Te devuelve el JSON con el resultado en pantalla.

Si volvés a tocar "Liquidar" una segunda vez, va a actualizar el mismo
registro (no duplica) — el `upsert` en `app/api/liquidar/route.ts` lo maneja.

## Actualización: novedades ya conectadas

Si ya tenías el proyecto corriendo y estás actualizando los archivos, hace
falta un paso más (una tabla nueva en la base):

```bash
npx prisma migrate dev --name add_novedades
```

Después, desde `/legajos` vas a ver un link a `/novedades` con instrucciones.
Detalle completo en `14-novedades-wireadas.md`.

## Actualización: auditoría ya conectada (requiere resetear la base local)

Esta vuelta agregó campos nuevos al legajo (obra social, CBU, banco) que la
auditoría necesita. Como ya tenías datos cargados, lo más simple es resetear
la base local — es solo el dato de prueba, no perdés nada real:

```bash
rm prisma/dev.db
npx prisma migrate dev --name add_auditoria_campos_legajo
```

Esto recrea la base de cero y vuelve a correr el seed automáticamente (con
los legajos ya actualizados — Ferreyra queda sin CBU a propósito, para que
la auditoría tenga algo concreto que marcar en la primera prueba). Vas a
tener que volver a importar las novedades de prueba si querés verlas de nuevo
(`/novedades`), el paso de liquidar y auditar sí quedan disponibles enseguida.

Después, desde `/legajos` vas a ver un link a `/auditoria`. Corré primero
"Liquidar", después andá a auditar — el orden importa, se audita lo que ya
se liquidó, no calcula nada nuevo.

## Actualización: cierre con salvedad ya conectado

```bash
npx prisma migrate dev --name add_cierre_salvedad
```

No hace falta resetear la base esta vez. Detalle completo en
`16-cierre-salvedad-wireado.md`.

## Actualización: recibos ya conectados (PDF real, con pdf-lib)

```bash
npm install
```

No hace falta migración de Prisma esta vez. Detalle completo en
`17-recibos-wireados.md` — incluye la aclaración de que este recibo es más
simple que el formato Anexo III completo.

## Actualización: editor de reglas, catálogo de conceptos y parámetros ya conectados

```bash
npx prisma migrate dev --name add_reglas_conceptos_parametros
```

No hace falta resetear la base. Detalle completo, con un ejemplo concreto
que cambia un número real (la antigüedad de Retamar), en
`18-reglas-conceptos-parametros-wireados.md`.

## ⚠️ Antes de CUALQUIER `npx prisma migrate dev`

Pará el servidor (`Ctrl+C` en la terminal de `npm run dev`) **antes** de correr
una migración. En Windows, si el servidor sigue corriendo, bloquea el archivo
del motor de Prisma y la migración falla a mitad de camino con un error
`EPERM`. Si ya te pasó: parás el servidor, corrés `npx prisma generate` a
mano, y volvés a levantar `npm run dev`.

## Actualización: dashboard y KPIs ya conectados

```bash
npx prisma migrate dev --name add_dashboard_fecha_egreso
npm install
```

No hace falta resetear la base. Dos secciones del dashboard (costo laboral
total y ausentismo) muestran una nota explícita en vez de un número — no es
un error, está explicado en `19-dashboard-kpis-wireados.md`.

## Actualización: exportación LSD/F.931 ya conectada

No hace falta migración ni instalar nada nuevo. Antes de pedir el LSD, andá
a `/conceptos` y asignale número a los conceptos que ya liquidaste
(`REM_BASICA`, `ANTIGUEDAD`, `HS_EXTRA_50`, `ADELANTO`) — si no, el sistema
te va a avisar cuáles faltan en vez de generar el archivo. Detalle completo
en `20-lsd-f931-wireados.md`.

## Actualización: estética final aplicada

No hace falta migración ni instalar nada nuevo — solo CSS y componentes.
Logo propio "FM Software" + paleta definitiva (celeste apagado, celeste
oscuro, blanco, gris claro, gris oscuro) + home con los módulos como
tarjetas. Detalle en `21-estetica-final.md`.

## Actualización: seed completo + F.931 con tasas reales

```bash
rm prisma/dev.db
npx prisma migrate dev --name seed_completo
```

⚠️ Esto reemplaza los datos existentes (reset consciente). Trae 5 legajos
completos, 9 conceptos numerados y 7 parámetros vigentes de una — antes
había que cargar todo eso a mano. Detalle en `22-seed-completo-y-f931-real.md`.

## Actualización: Excel real en novedades + alta manual + edición de conceptos

```bash
npm install
```

No hace falta migración, sí reinstalar (agrega `xlsx`). Detalle en
`23-novedades-excel-manual-conceptos-editables.md`.

## Actualización: períodos con nombre y fecha desde/hasta reales

```bash
rm prisma/dev.db
npx prisma migrate dev --name periodos_con_fechas
```

⚠️ Reset de base (el cambio de anio/mes a fechas no es compatible con datos
viejos). Ahora podés crear quincenas reales desde `/periodos`. Detalle
completo, incluyendo qué se corrigió en el cálculo de días del período, en
`24-periodos-fecha-real.md`.

## Actualización: ficha de empleado ampliada

```bash
rm prisma/dev.db
npx prisma migrate dev --name ficha_empleado_ampliada
```

⚠️ Reset de base. Ahora hay botón "+ Nuevo empleado" con legajo sugerido
automático, edición de empleados existentes, y 15 campos nuevos (datos
personales, foto, centro de costo, ART). Detalle en
`25-ficha-empleado-ampliada.md`.

## Actualización: novedades agrupadas por categoría (estilo Tango)

```bash
rm prisma/dev.db
npx prisma migrate dev --name categoria_novedad
```

⚠️ Reset de base. El selector de concepto en `/novedades` ahora agrupa por
categoría (Horas, Licencias, Préstamos...) en vez de una lista plana.
Detalle en `26-novedades-por-categoria.md`.

## Actualización: vacaciones (notificación PDF, pendientes, histórico, Gantt)

```bash
rm prisma/dev.db
npx prisma migrate dev --name vacaciones
```

⚠️ Reset de base (tabla nueva). Días calculados por antigüedad (Art. 150
LCT, con los casos límite probados), notificación descargable en PDF,
detección de pendientes, y un Gantt filtrable por centro de costo. Detalle
completo en `27-vacaciones.md`.

## Actualización: login (usuario/contraseña)

```bash
npm install
rm prisma/dev.db
npx prisma migrate dev --name usuario_login
```

⚠️ Reset de base (tabla nueva `Usuario`) + dos dependencias nuevas
(`bcryptjs`, `jose`). Ahora TODA la app pide login — entrá con
`fernando@fmconsultora.com` / `cambiar123` (del seed). Detalle completo,
incluyendo por qué el código de sesión está separado en dos archivos, en
`28-login.md`.

## Actualización: pantalla de usuarios + permisos por rol

No hace falta migración ni instalar nada nuevo — el modelo `Usuario` ya
existía. `/usuarios` (solo para admins) permite crear, editar y eliminar
usuarios. Los roles `operador` y `lectura` ahora significan algo de verdad:
`lectura` no puede modificar nada en ningún lado, y ni `operador` ni
`lectura` pueden entrar a Conceptos/Reglas/Parámetros/Usuarios. Detalle
completo en `29-usuarios-y-permisos.md`.

## Actualización: migración a Postgres real (vuelta 30)

Cambio grande — de SQLite a Postgres real. No hay un simple `npx prisma
migrate dev` para esto, porque primero hace falta conseguir un Postgres al
que conectarse. Los pasos completos, con las tres opciones para conseguirlo,
están en `30-migracion-postgres.md` y en las instrucciones al principio de
este mismo archivo (ya actualizadas). En resumen:

```bash
npm install
cp .env.example .env
# editar .env con tu DATABASE_URL real
rm -r prisma/migrations
rm prisma/dev.db   # si existe — ya no se usa
npx prisma migrate dev --name migracion_postgres
npm run dev
```

## Actualización: convenio corregido con el código real (vuelta 31)

```bash
npx tsx prisma/fix-convenio-real.ts
```

No destructivo, no borra nada de lo que ya cargaste. Corrige el código de
convenio inventado (`0074/89`) por el real (`0335/75`, Madera-USIMRA) y
agrega el convenio `9999/99` (Excluido de Convenio). Detalle en
`31-convenio-real-corregido.md`.

## Actualización: cálculo por hora para Madera (vuelta 32)

```bash
npx tsx prisma/set-formula-horaria-madera.ts
```

⚠️ No destructivo, pero **cambia los números** que ya calculaste para
legajos de Madera — es esperado (dos metodologías de cálculo distintas, la
nueva coincide con tu Excel real). Detalle en `32-calculo-por-hora.md`.

## Actualización: catálogo real completo (vuelta 33)

```bash
npx tsx prisma/import-catalogo-real.ts
```

No destructivo. Carga 19 conceptos con números reales de ARCA, 48
categorías y 44 escalas reales. Una categoría ("PEON", Madera, 9 empleados
activos) queda sin escala a propósito — no hay valor real en el Excel
todavía. Detalle en `33-catalogo-real.md`.

## Actualización: escala de Peón resuelta (vuelta 34)

```bash
npx tsx prisma/resolver-escala-peon.ts
```

No destructivo. Copia el valor real de "Operario Act. Industrial" (misma
categoría, nombre distinto) — validado contra el PDF oficial de USIMRA.
Detalle en `34-peon-resuelto.md`.

## Actualización: sección de Empresas (multi-cliente) (vuelta 35)

No hace falta migración ni instalar nada nuevo — solo código. Se agregó
`/empresas` (solo admin) y un selector de "empresa activa" en la barra —
antes todo tomaba siempre la primera empresa de la base sin dejar elegir.
Detalle en `35-empresas-multi-cliente.md`.

## Actualización: 125 empleados reales de Moras cargados (vuelta 36)

```bash
npx tsx prisma/eliminar-legajos-prueba.ts
npx tsx prisma/import-empleados-reales.ts
```

⚠️ El primer script **elimina** los 5 legajos de prueba (Retamar, Bassi,
Ferreyra, Duarte, Coria) y todo lo que dependía de ellos — es necesario
correrlo antes del segundo, por un choque de número de legajo real. El
segundo importa 121 de 126 empleados reales (5 quedaron afuera por datos
incompletos en el origen, detallado en `36-empleados-reales.md`). No hace
falta migración.

## Actualización: reglas de Comercio, validadas contra recibo real (vuelta 38)

```bash
npx tsx prisma/crear-reglas-comercio.ts
```

No destructivo. Comercio no tenía NINGUNA regla cargada (ni siquiera el
básico) — ahora tiene las 9 (3 remunerativas + 6 descuentos), probadas
contra el recibo real de Fernando Martínez con coincidencia exacta. Detalle
completo, incluyendo los dos bugs que aparecieron en el camino, en
`38-validado-contra-recibo-real.md`.

## Actualización: bug de zona horaria en escalas corregido (vuelta 39)

```bash
npx tsx prisma/fix-zona-horaria-escalas.ts
```

No destructivo. Las fechas de vigencia de las escalas se guardaron sin zona
horaria explícita, y en una máquina en horario de Argentina se corrían
unas horas — suficiente para que una escala vigente "desde el 1° de julio"
no se encontrara al liquidar justo ese día. Detalle en
`39-fix-zona-horaria.md`.

## Actualización: menú reorganizado por categorías (vuelta 40)

No hace falta migración — solo código de navegación. La barra pasa de una
lista plana de 12 links a 7 categorías desplegables (Maestros, Novedades,
Liquidaciones, Procesos, Salidas, Reportes, Administración), siguiendo el
árbol que armaste. Detalle completo, con el mapeo honesto de qué existe
como pantalla propia y qué no, en `40-menu-categorizado.md`.

## Actualización: preliquidación en tabla, exportable (vuelta 41)

No hace falta migración — solo pantallas y código nuevos. `/preliquidacion`
muestra el resultado de liquidar como una tabla legible (nombres reales,
no códigos), exportable a CSV para mandar al cliente. El botón "Liquidar"
en `/legajos` ya no vuelca JSON crudo como resultado principal. Detalle en
`41-preliquidacion.md`.

## Actualización: Peón corregido para julio, escalas duplicadas limpiadas (vuelta 42)

```bash
npx tsx prisma/resolver-escala-peon.ts
npx tsx prisma/limpiar-escalas-duplicadas.ts
```

No destructivos. Peón tenía el valor de septiembre en vez de julio (mismo
patrón que afectó a otras 23 categorías). De paso se limpian filas de
escala duplicadas (no eran la causa del problema, pero ensuciaban la
tabla). Detalle en `42-fix-peon-julio.md`.

## Actualización: categorías individuales para directores (vuelta 43)

```bash
npx tsx prisma/crear-categorias-directores.ts
```

Después, completá los 3 sueldos reales en
`prisma/cargar-sueldos-directores.ts` (vienen en 0 a propósito — el script
se frena si detecta algún 0 sin completar) y corré:

```bash
npx tsx prisma/cargar-sueldos-directores.ts
```

No destructivos. Detalle en `43-categorias-directores.md`.

## Actualización: liquidar separado, con filtros y tabla de estado (vuelta 44)

No hace falta migración — solo código nuevo y reorganizado. `/liquidar` es
ahora su propia pantalla (separada de `/legajos`), con tres formas de
elegir a quién liquidar (todos / por convenio / por rango de legajo) y una
tabla compacta de estado en vez del JSON largo de antes. De paso se
corrigió un problema real de rendimiento (inserciones en lote). Detalle en
`44-liquidar-separado.md`.

## Actualización: REM_TOTAL()/NOREM_TOTAL() en el motor, descuentos de Madera (vuelta 45)

No hace falta migración. El motor de reglas (`lib/motor/motor-reglas.mjs`)
ahora soporta `REM_TOTAL()` y `NOREM_TOTAL()` — probado con regresión
completa contra el caso real de Comercio (sigue exacto) antes de tocar la
app. Después:

```bash
npx tsx prisma/crear-reglas-madera-descuentos.ts
```

⚠️ Esto **cambia el neto** de los legajos de Madera que ya liquidaste —
ahora tienen los 4 descuentos (Jubilación, Ley 19.032, Obra Social,
Sindicato) que antes no tenían. Detalle completo, incluyendo la
investigación sobre el sistema de Remuneraciones 1-10 de ARCA (con fuente
oficial), en `45-rem-total-y-descuentos-madera.md`.

## Actualización: número de concepto manual, VALOR_CATEGORIA()/CANTIDAD() (vuelta 46)

```bash
npx prisma migrate dev --name valor_concepto_categoria
```

Tabla nueva (`ValorConceptoCategoria`), no toca datos existentes. El motor
de reglas ahora soporta `VALOR_CATEGORIA('código')` y `CANTIDAD()` —
probado con regresión antes de tocar la app. `/conceptos` ahora deja
elegir el número al crear, en vez de forzar el sugerido. Detalle completo,
con el paso a paso para cargar un valor por categoría, en
`46-valor-categoria-cantidad.md`.

## Actualización: borrado forzado de conceptos en uso (vuelta 47)

No hace falta migración. Si un concepto está en uso, ahora `/conceptos` te
ofrece forzar el borrado (con el detalle de qué se va a eliminar) en vez
de solo bloquearte sin salida. Detalle en `47-borrado-forzado-conceptos.md`.

## Actualización: "Probar concepto" (vuelta 47/48)

No hace falta migración. En `/reglas`, ahora podés probar una fórmula
(todavía sin guardar) contra un legajo y período reales — sin persistir
nada — y ver el resultado numérico con la fórmula desglosada, no solo si
la sintaxis es válida. Primera pieza de la propuesta grande del
"Constructor de Conceptos". Detalle en `48-probar-concepto.md`.

## Actualización: grafo de dependencias visual (vuelta 49)

No hace falta migración. En `/reglas`, ahora se ve automáticamente "DEPENDE
DE" (qué necesita esta fórmula) y "ES UTILIZADO POR" (qué otras reglas la
referencian) — mismo mecanismo que la validación de sintaxis, se actualiza
solo. Detalle en `49-grafo-dependencias.md`.

## Actualización: biblioteca de fórmulas prearmadas (vuelta 50)

No hace falta migración. En `/reglas`, un desplegable de "Fórmulas
habituales" con 9 patrones ya validados en este proyecto (Antigüedad,
Presentismo, los descuentos de Madera, valor por categoría, tope, monto
fijo) — elegís, completás un par de campos, se inserta la fórmula armada
en el editor. Detalle en `50-biblioteca-formulas.md`.

## Actualización: constructor visual — panel de inserción (vuelta 51)

No hace falta migración. En `/reglas`, un panel a la derecha del editor
con 4 categorías (Datos del empleado, Conceptos, Parámetros, Funciones) —
cada botón inserta el token exacto donde esté el cursor, sin tener que
memorizar la sintaxis de `CONCEPTO()`/`TOPE()`. Detalle en
`51-constructor-visual.md`.

## Actualización: Sindicato corregido, Seguro Sepelio y S.N.R. de Madera (vuelta 52)

```bash
npx tsx prisma/fix-sindicato-y-no-remunerativos.ts
```

No destructivo. ⚠️ Cambia el neto de los legajos de Madera ya liquidados —
Sindicato corregido (1,5%→3%, era un error mío mezclando dos líneas del
mismo PDF), Seguro Sepelio nuevo (1,5%), y el no remunerativo S.N.R.
(1,90% del básico) — los tres con fuente en el PDF oficial de USIMRA.
Detalle en `52-sindicato-y-no-remunerativos.md`.

## Actualización: recibo completo de Comercio validado, Redondeo, Convenios y Categorías (vuelta 53)

```bash
npx tsx prisma/actualizar-escalas-comercio-julio.ts
npx tsx prisma/agregar-no-remunerativos-comercio.ts
npx tsx prisma/crear-redondeo.ts
```

No destructivos. ⚠️ Cambia el neto de todos los legajos ya liquidados —
escalas de Comercio actualizadas (las 21 categorías), Presentismo
corregido (0,0833→1/12 exacto, validado contra un recibo real completo de
15 líneas), 7 conceptos no remunerativos nuevos, Sindicato/Faecys con base
ampliada, y Redondeo del neto (nueva capacidad del motor: una tercera
etapa de cálculo). De paso, pantallas nuevas `/convenios` y `/categorias`.
Detalle completo, incluyendo un aviso sobre código pre-existente que
encontré y validé en vez de asumir, en `53-recibo-completo-comercio.md`.

## Actualización: recibo conforme Ley 27.802 / Decreto 407/2026 (vuelta 54)

```bash
npx prisma migrate dev --name recibo_ley27802
npx tsx prisma/cargar-domicilio-empresa.ts
```

Recibo rediseñado completo: 4 bloques legales obligatorios, tus columnas
(Cód./Concepto/Cant./Remunerativo/No remunerativo), gráfico de torta a
color dibujado a mano en pdf-lib (con el eje Y corregido — ver detalle),
y sección de contribuciones patronales lista pero vacía hasta tener las
tasas reales. Detalle completo en `54-recibo-ley27802.md`.

## Actualización: "Cant." derivado de la fórmula real, pantalla de Escalas (vuelta 55)

No hace falta migración. El recibo ahora muestra horas para Madera (antes
mostraba días por error, hardcodeado) — se deriva automáticamente de qué
variable usa la fórmula real de cada concepto, no de un código fijo.
Nueva pantalla `/escalas` para cargar aumentos futuros sin pisar el
historial. Detalle en `55-cantidad-y-escalas.md`.

## Actualización: 2 de 4 contribuciones patronales cargadas (vuelta 56)

```bash
npx tsx prisma/crear-contribuciones-patronales-nacionales.ts
```

No destructivo. Jubilación (18%, SIPA+INSSJP+FNE+AAFF combinado) y Obra
Social patronal (6%) — confirmadas con fuente oficial, de ley nacional.
ART y Seguro de Vida Colectivo siguen pendientes (dependen de datos
específicos de Moras que solo vos podés confirmar). Detalle en
`56-contribuciones-patronales.md`.

## Actualización: ART y Seguro de Vida patronal, las 4 contribuciones completas (vuelta 57)

```bash
npx tsx prisma/crear-art-y-seguro-vida-patronal.ts
```

No destructivo. ART (3,1211%, Madera+Comercio) y Seguro de Vida patronal
(1,6%, solo Madera) — tasas reales de Moras. La torta del recibo ya
debería mostrar los 5 rubros completos. Para cambiar cualquier tasa a
futuro (nuevos clientes), usá `/reglas` directamente — ya soporta
cualquier código de concepto, no hace falta pantalla nueva. Detalle en
`57-art-y-seguro-vida-patronal.md`.

## Actualización: la torta ya suma 100% del costo laboral total (vuelta 58)

```bash
npx tsx prisma/asignar-rubro-deducciones.ts
```

No destructivo. Los aportes del empleado (Jubilación, Obra Social,
Sindicato, Faecys) ahora se agrupan en la misma porción que su
contribución patronal equivalente — antes faltaban, dejando un espacio en
blanco sin dibujar. Verificado con matemática exacta (100,00%) contra tus
propios números reales. Detalle en `58-torta-completa.md`.

## Actualización: LSD corregido, eliminar liquidaciones, período de prueba (vuelta 59)

No hace falta migración.

```bash
npx tsx prisma/crear-periodo-agosto-q1.ts
```

LSD ya no incluye contribuciones patronales por error (iban a F.931, no a
LSD). Nuevo botón "Eliminar liquidación" en `/liquidar`, con el mismo
filtro que liquidar. Se creó "1ra. Quincena Agosto 2026" para probar con
novedades reales. F.931 tiene un hallazgo importante sin resolver todavía
(recalcula tasas propias en vez de leer lo ya calculado) — ver detalle.
Todo en `59-lsd-f931-eliminar-liquidacion.md`.

## Actualización: cierre obligatorio antes de exportar, Recibos masivos (vuelta 60)

No hace falta migración.

```bash
npm run dev
```

LSD/F.931 ahora exigen el período cerrado (antes no revisaban esto).
"Legajos sin liquidar" bloquea el cierre. Liquidar/borrar quedan
bloqueados sobre un período cerrado — hay que reabrir primero (botón
nuevo en `/auditoria`) para editar a propósito. Nueva pantalla `/recibos`
con descarga masiva (PDF combinado, no ZIP — no había forma de probar una
librería de ZIP sin internet). Menú reorganizado: Períodos, Liquidación,
Recibos, Vacaciones. Detalle completo en `60-recibos-masivos.md`.

## Actualización: auditoría con desplegable y JSON garantizado (vuelta 61)

No hace falta migración. `/auditoria` ya no pide escribir el periodoId a
mano — es un desplegable de períodos reales, como el resto del proyecto.
De paso se corrigió `/api/auditar`, que no tenía la red de seguridad de
JSON garantizado (causaba el error "Unexpected end of JSON input" con un
periodoId inválido). Detalle en `61-auditoria-desplegable.md`.

## Actualización: legajo "Inactivo", fecha de baja y motivo (vuelta 62)

```bash
npx prisma migrate dev --name motivo_baja
```

Agrega una columna nueva, no toca datos existentes. "Inactivo" es una
condición nueva que saca al legajo de liquidaciones y de todas las
alertas de auditoría, sin marcarlo como baja real — útil para legajos de
prueba sin datos reales de CBU/banco. Fecha de baja y motivo ya son
editables en el formulario. Detalle en `62-legajo-inactivo.md`.

## Actualización: horas reales por novedad, auditoría inteligente, quincenas de Madera (vuelta 63)

No hace falta migración.

```bash
npx tsx prisma/crear-concepto-horas-cargadas.ts
npx tsx prisma/crear-quincenas-julio-madera.ts
```

Nuevo concepto "Horas trabajadas (cargadas por novedad)" — cuando se
carga, pisa la asunción genérica de 8hs/día en `/api/liquidar` y en el
recibo. La alerta "sin novedades" ahora solo avisa para convenios cuyo
básico depende de horas (Madera) — Comercio nunca avisa, como en Tango.
Dos quincenas de julio creadas para Madera, en paralelo al mensual de
Comercio. Detalle completo en `63-novedades-horas-reales.md`.

## Actualización: novedades con desplegable y JSON garantizado (vuelta 64)

No hace falta migración. `/novedades` ya no pide escribir el periodoId a
mano — desplegable real, como el resto del proyecto. `/api/legajos` ya
tiene la red de seguridad de JSON garantizado que le faltaba (causaba el
mismo error que ya vimos en auditoría). Detalle en
`64-novedades-desplegable.md`.

## Actualización: eliminar novedades masivamente (vuelta 65)

No hace falta migración. `/novedades` ahora tiene una sección para borrar
novedades — mismo filtro (todos/convenio/rango) que ya conocés, más un
filtro opcional por concepto. Detalle en `65-eliminar-novedades.md`.

## Actualización: Ausencias y Presentismo "todo o nada" para Madera (vuelta 66)

```bash
npx tsx prisma/crear-antiguedad-presentismo-ausencias-madera.ts
```

No destructivo. ⚠️ Cambia el neto de los legajos de Madera ya liquidados
(ahora tienen Antigüedad y Presentismo, que nunca existieron para este
convenio). Validado exacto contra tu Excel real (Chousa con ausencia →
$0 de presentismo; Carabajal sin ausencia → $81.788,04). Detalle en
`66-ausencias-presentismo.md`.

## Actualización: Enfermedades, Feriados, Accidente, Vacaciones, S.N.R. real (vuelta 67)

```bash
npx tsx prisma/crear-enfermedades-feriados-art-vacaciones-madera.ts
```

No destructivo. ⚠️ Cambia el neto de los legajos de Madera ya liquidados.
Completa el plan de conversión de Madera — probado contra dos empleados
reales distintos (Chousa con ausencia, Pereyra con enfermedad), exacto en
los dos casos. Se encontró de paso una celda sin fórmula (un ajuste manual
puntual) que a propósito no se replicó como regla general. Detalle en
`67-enfermedades-snr.md`.

## Actualización: tres bugs corregidos (vuelta 68)

No hace falta migración.

- **Eliminar liquidaciones**: ahora es una transacción atómica — el error
  de "RESTRICT" no debería volver a aparecer.
- **Filtro por rango en /recibos** (y /liquidar y /novedades): "hasta"
  vacío ahora sí significa "un solo legajo", no "todos por accidente".
- **Recibo más limpio**: los conceptos que dependen de su propia novedad
  (Ausencias, Enfermedades...) ya no se muestran cuando dan $0.

Detalle completo en `68-tres-bugs.md`.

## Actualización: nombres de conceptos estilo Tango (vuelta 69)

```bash
npx tsx prisma/renombrar-conceptos-tango.ts
```

No destructivo. Renombra `HORAS_TRABAJADAS_CARGADAS`→`HS_NORMALES`,
`ENFERMEDADES`→`HS_ENFERMEDAD`, `HS_ACCIDENTE`→`HS_ART`, y actualiza las
fórmulas que los mencionan. Confirmado con regresión (mismos casos reales
de siempre). Detalle en `69-nombres-tango.md`.

## Actualización: Antigüedad reconocida conectada, navegación, inactivos ocultos (vuelta 70)

```bash
npx prisma migrate dev --name periodos_anteriores
```

Corrige un bug real: "Antigüedad reconocida" nunca llegaba al cálculo de
liquidación (solo a vacaciones) — ahora sí. Nueva sección de "Períodos
anteriores trabajados" (documental). Navegación anterior/siguiente entre
legajos. Inactivos/bajas ocultos por defecto en `/legajos`. Detalle en
`70-antiguedad-navegacion-inactivos.md`.

## Actualización: período con convenio fijado (vuelta 71, parte 1)

```bash
npx prisma migrate dev --name periodo_convenio
npx tsx prisma/fijar-convenio-quincenas-madera.ts
```

Corrige que "Todos" en /liquidar mezclaba convenios en un período pensado
para uno solo (el caso real: Comercio coló en una quincena de Madera). El
script también limpia las liquidaciones que ya se habían colado. Detalle
en `71-periodo-convenio.md`. Sigue pendiente el diagnóstico de Redondeo.

## Actualización: LSD con códigos ARCA reales (vuelta 72)

```bash
npx prisma migrate dev --name codigo_arca
npx tsx prisma/mapear-codigos-arca.ts
```

Nuestra numeración interna nunca fue la de ARCA — campo nuevo
`codigoArca`, mapeado con fuente oficial donde se pudo confirmar, y
marcado "PROVISORIO" donde no. Dos bugs más corregidos en la ruta LSD:
cantidad/unidad nunca se completaban, y Débito/Crédito estaba fijo en "D"
para todo. Mecanismo nuevo de Horas Normales + Ausencias (crédito
nominal completo + débito explícito). Detalle en `72-lsd-codigos-arca.md`.
Sigue pendiente el acumulado mensual para quincenales.

## Actualización: recuperación de Enfermedad, borrado seguro (vuelta 73)

```bash
npx tsx prisma/recuperar-enfermedad.ts
npx tsx prisma/mapear-codigos-arca.ts
```

No destructivo. Recupera el motor roto (Antigüedad/Presentismo/S.N.R.
seguían mencionando un concepto ya borrado). El borrado de conceptos
ahora revisa si OTRAS fórmulas lo mencionan por nombre antes de permitir
nada — sin "forzar" posible para ese caso, hay que arreglar la fórmula
primero. Detalle en `73-borrado-seguro.md`.

## Actualización: auditoría respeta convenio, LSD sin violar anchos (vuelta 74)

No hace falta migración.

```bash
npm run dev
```

Auditoría ahora respeta el convenio fijado del período (antes ignoraba
esto, avisaba de más). Campo "Unidades" del LSD corregido a 1 carácter
("H", provisorio). Detalle en `74-auditoria-convenio-lsd-unidades.md`.

## Si algo falla

- **`Cannot find module '@prisma/client'`** → te faltó el `npm install`.
- **`Table 'empresas' doesn't exist`** → te faltó `npx prisma migrate dev`.
- **La página de legajos dice "No hay datos cargados"** → te faltó
  `npm run prisma:seed`.
- **Error de TypeScript en el import de `motor-reglas.mjs`** → es esperable
  y no debería frenar `npm run dev` (Next.js compila igual); si te bloquea
  el build de producción, avisame y lo resuelvo con un archivo de tipos.

## Qué es real acá y qué no (estado actual, vuelta 30)

✅ **Real**: Postgres real, todos los módulos (legajos, novedades, reglas,
auditoría, recibos, LSD/F.931, dashboard, vacaciones, login con permisos por
rol), la estética definitiva.
⚠️ **Simplificado a propósito, documentado en cada doc correspondiente**:
- Montos en `Float`, no `Decimal` (ver `30-migracion-postgres.md`).
- Sin Row-Level Security — el código asume una sola empresa.
- Sin la aplicación desplegada — corre con `npm run dev`, no es accesible
  desde otra computadora todavía.
- Varios detalles menores, uno por módulo, en la sección "Qué falta" de cada
  documento (`01` a `30` en la carpeta de docs).
