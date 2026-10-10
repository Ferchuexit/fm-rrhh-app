# 80 · Roles y permisos (Parte A)

## Qué resuelve

Hasta ahora había tres niveles fijos (admin, operador, lectura) iguales para
todas las empresas. Ahora cada usuario tiene, **en cada empresa**, un **rol**
que define qué puede hacer módulo por módulo.

## Conceptos

- **Módulo**: una parte del panel (Legajos, Novedades, Liquidaciones, Cierre,
  Exportar, Reportes, Configuración, Noticias, Legajo digital, Vacaciones y
  permisos, Firmas de recibos, Asistencia, Dispositivos, Accesos al portal).
- **Nivel** por módulo: *sin acceso*, *ver* o *gestionar*.
  - *ver* permite consultar (GET) y las búsquedas que técnicamente son POST.
  - *gestionar* permite además crear, modificar y borrar.
- **Rol**: un nombre + la grilla módulo × nivel. Se administran en
  **Plataforma → Roles y permisos** (`/roles`).
- **Asignación**: en **Usuarios**, al tildar una empresa se elige el rol que el
  usuario tiene en esa empresa. Un mismo usuario puede ser "RR.HH. completo" en
  una empresa y "Solo lectura" en otra.

## Roles predefinidos

Los crea la migración. Se pueden copiar para armar variantes; no se pueden
borrar.

| Rol | Alcance |
| --- | --- |
| RR.HH. completo | Gestiona todo menos Configuración |
| Liquidador | Gestiona legajos, novedades, liquidaciones, cierre y exportar; ve reportes, asistencia, vacaciones y firmas |
| Supervisor | Ve legajos; gestiona asistencia, vacaciones, legajo digital, noticias y accesos al portal. No ve sueldos ni liquidaciones |
| Solo lectura | Ve todo menos Configuración y Dispositivos, no modifica nada |

## Lo que NO se delega

Usuarios, Roles y Empresas son **solo del administrador**. No existe un nivel
de rol que los habilite: así un rol mal configurado nunca puede darse permisos
a sí mismo.

## Usuarios que ya existían

No cambian. Si un usuario no tiene rol asignado en una empresa, se le aplican
los permisos equivalentes a su nivel anterior (`permisosHeredados`):
operador = gestionar todo menos Configuración y Dispositivos; lectura = ver
todo. El administrador sigue teniendo acceso total.

## Cómo se aplica (técnico)

- La regla vive en `lib/permisos.ts` (`puedeAcceder`) y la usan **el
  middleware** (bloquea páginas y APIs) y **el menú** (oculta lo que no se
  puede abrir). Una sola fuente de verdad: lo que se ve en el menú es lo que
  se puede usar.
- El middleware corre en Edge y no puede consultar la base, por eso los
  permisos viajan dentro del token de sesión y se **renuevan solos**:
  - al navegar, si tienen más de 5 minutos (`/api/sesion/renovar`);
  - las APIs rechazan tokens con permisos de más de 8 horas.
- Consecuencia práctica: **un cambio de rol tarda hasta ~5 minutos** en
  impactar en un usuario que ya está adentro (o es inmediato si vuelve a
  ingresar).
- Acceso denegado: las páginas redirigen al inicio, las APIs responden 403 en
  JSON.
- `tests/permisos.test.mjs` recorre el disco y falla si aparece una ruta nueva
  sin clasificar en ningún módulo: al agregar una pantalla o API hay que
  sumarla a `MODULOS` (o a las listas de rutas públicas / solo admin).

## Instalación

Trae migración (`roles_permisos`: tabla `Rol` y columna `rolId` en
`UsuarioEmpresa`):

```
npx prisma migrate deploy
npx prisma generate
```

## Pendiente (Parte B)

- Jerarquía "reporta a" en el legajo.
- Vacaciones: las **solicita el jefe** para su equipo (es quien coordina la
  producción) y **RR.HH. aprueba o rechaza** según las directivas de dirección.
- Alcance por sector en los módulos de Gestión Humana (que un supervisor vea
  solo a su gente).
