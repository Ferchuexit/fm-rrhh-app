# 101 — Organigrama visual, armado rápido de la estructura y carga de legajos desde Excel

## El organigrama dibujado

Comunicación interna → Organigrama (panel) y Portal → Organigrama. Una
tarjeta por persona —iniciales, sector, nombre y puesto— unida por líneas a
su jefe, con el contador de cuánta gente tiene por debajo.

- **Abrir y cerrar ramas** tocando el contador. De entrada se ven los dos
  primeros niveles; en el portal, además, el camino hasta la persona.
- **Buscador** por persona, puesto o sector: resalta los resultados, atenúa
  el resto y abre solo el camino hasta cada uno.
- **Zoom**, "Abrir todo" / "Cerrar", e impresión.
- **Pensado para una planta**: los que no tienen gente a cargo van en una
  grilla compacta debajo de su jefe (30 operarios en fila serían imposibles
  de recorrer); solo las ramas con más niveles se abren a los costados.
- El color del sector ayuda a ubicarse, pero el sector va siempre escrito.
- En el portal la tarjeta propia va resaltada y, si los mensajes entre
  compañeros están activos, cada nombre abre el chat con esa persona.
- Quien no tiene jefe ni gente a cargo figura abajo como "sin ubicar".

La vista "Puestos y vacantes" (dotación prevista contra ocupantes) sigue
estando. Las fotos del legajo todavía no se usan en las tarjetas.

Código: `app/organigrama/Arbol.tsx`, `armarArbol` en
`lib/organigrama-reglas.ts`.

## Armar la estructura sin entrar legajo por legajo

Organigrama → **Armar la estructura**: una tabla con toda la gente y, de
cada uno, sector, puesto y a quién reporta. Se filtra (sin jefe, sin
puesto, sin sector), se tildan varios y se les aplica lo mismo de una vez.
Lo cambiado queda resaltado; nada se guarda hasta tocar Guardar.

Al guardar se revisa la estructura completa: si con los cambios alguien
terminaría reportándose a sí mismo (un círculo), no se guarda nada y se
dice quiénes. Un usuario limitado a sectores solo mueve a su gente; hace
falta el módulo Organigrama en "gestionar".

## Cargar legajos desde Excel

Legajos → **Cargar varios desde Excel** (`/legajos/importar`).

1. Se baja la **planilla modelo**: la hoja "Legajos" con las columnas y la
   hoja "Referencias" con los convenios, categorías, sectores y puestos de
   esa empresa, escritos como hay que ponerlos.
2. Se sube completa. El navegador lee el Excel; el servidor analiza.
3. **Antes de guardar** se ve fila por fila qué pasa: se crea, se actualiza
   o tiene un error (y cuál). Con una sola fila con error no se guarda
   ninguna, para que la carga no quede por la mitad.

Reglas:

- Obligatorias: apellido, nombre, CUIL, fecha de ingreso, categoría. El
  convenio se puede dejar vacío si toda la empresa usa el mismo.
- El CUIL se valida con su dígito verificador. Las fechas van día/mes/año
  (o como fecha de Excel).
- El legajo vacío recibe el siguiente número libre.
- Sector y puesto que no existen **se crean** (se avisa cuáles).
- "Reporta a" es el número de legajo o el CUIL del jefe, que puede estar
  en la misma planilla.
- **Si el CUIL ya existe**, de esa fila solo se toman sector, puesto y
  jefe: sirve para acomodar la estructura. Nunca pisa datos de liquidación.
- Hasta 500 filas por planilla.

Se cargan los datos básicos. Banco, obra social, cargas de familia y el
resto de la ficha se completan después en cada legajo.

Código: `lib/importar-legajos-reglas.ts` (puro,
`tests/importar-legajos-reglas.test.mjs`), `app/api/legajos/importar`,
`app/legajos/importar`.
