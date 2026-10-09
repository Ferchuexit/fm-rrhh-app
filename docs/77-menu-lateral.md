# FM RRHH — Menú lateral y portal tipo "Apps" (v1)

Vuelta 77. La barra de desplegables horizontales ya no entraba (10
categorías y creciendo con cada módulo de Gestión Humana). Se pasó a la
arquitectura habitual de las plataformas de RR.HH.: barra superior fina +
menú lateral.

## Panel (RR.HH. / consultora)

- **Barra superior**: solo lo global — ☰, logo, selector de empresa,
  usuario, salir.
- **Menú lateral**: Inicio + categorías como grupos desplegables. El grupo
  de la pantalla actual arranca abierto y el ítem activo queda resaltado.
- **☰ en escritorio** lo achica a solo íconos; se recuerda entre pantallas
  (localStorage, aplicado antes del primer pintado para que no "salte").
- **En pantallas angostas** (< 900 px) el menú es un cajón que se abre con ☰.
- **Al imprimir**, el menú no sale en el papel.

Las categorías se agrupan en dos **bloques** (`bloque` en
`lib/menu-estructura.ts`, que sigue siendo el único lugar donde se define el
menú — lo leen el lateral y la home):

| Bloque | Categorías |
|---|---|
| Liquidación de sueldos | Maestros, Novedades, Liquidaciones, Procesos, Salidas, Reportes, Configuración |
| Gestión Humana | Gestión de RR.HH., Operaciones, Plataforma |

### Qué cambió de lugar

| Pantalla | Antes | Ahora |
|---|---|---|
| Asistencia, Fichadas, Dispositivos | Novedades | Operaciones |
| Vacaciones | Liquidaciones | Gestión de RR.HH. |
| Solicitudes, Firmas de recibos | Portal del empleado | Gestión de RR.HH. |
| Accesos al portal | Portal del empleado | Plataforma |
| Usuarios | Administración | Plataforma |
| Parámetros, Estado por convenio, Actualizaciones normativas | Administración | Configuración |

Ninguna URL cambió — solo dónde aparece cada link. Para mover algo, se
cambia de lugar su línea en `menu-estructura.ts`.

Las áreas que faltan (Comunicación interna, Desarrollo de talento, Cultura)
se suman como categorías nuevas del bloque Gestión Humana cuando tengan su
primera pantalla; una categoría sin ítems visibles no se dibuja.

## Portal del empleado

- **Inicio (`/portal`)**: grilla de "apps" con globito rojo de pendientes
  (hoy: recibos sin firmar). Cada módulo nuevo es una entrada más en `APPS`.
- **Barra inferior fija**: Inicio / Recibos / Vacaciones — reemplaza las
  pestañas de arriba, que no escalaban a más de dos o tres secciones.
- La lista de recibos pasó de `/portal` a `/portal/recibos`.

## Cómo aplicar esto

Sin migración ni dependencias nuevas — es solo navegación.

## Qué falta

- **Buscador de pantallas** en la barra superior.
- **Globitos en el menú del panel** (por ejemplo, solicitudes pendientes).
- **Pantallas anchas en el celular**: varias tablas del panel (legajos,
  asistencia, preliquidación) se siguen saliendo del ancho en un teléfono.
  El panel está pensado para escritorio; el portal sí es mobile-first.
- **Íconos**: el menú usa los mismos emojis que ya tenía la home. Pasar a
  un set de íconos de trazo (como los de la barra del portal) es un cambio
  de presentación aparte.
