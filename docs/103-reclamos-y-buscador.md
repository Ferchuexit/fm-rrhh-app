# 103 — Reclamos de haberes y buscador del panel

## Reclamos de haberes

El empleado reclama, desde el portal, algo de un recibo: horas que faltaron, un premio, un descuento que no corresponde. Idea tomada de la app de una autopartista (Haberes → Reclamos).

**Portal** (`/portal/reclamos`, botón en *Mis recibos* y en cada recibo):
- Elige el recibo (los publicados de los últimos dos años: art. 256 LCT) o "no es de un recibo en particular".
- Tilda uno o varios motivos de la lista de la empresa; según el motivo pide horas, días o importe, más un detalle opcional ("Otro" pide contar qué pasó).
- Máximo 5 reclamos esperando respuesta a la vez.
- Ve el estado y la respuesta de cada reclamo: qué ítem se aprobó (y cuánto), qué no y por qué, y en qué liquidación se ajusta. El cuadrito "Reclamos" del inicio aparece cuando hizo alguno, con globo si hay respuestas sin leer.

**Panel** (`/reclamos`, Gestión de RR.HH.):
- *Pendientes*: al lado del reclamo se ven las líneas del recibo reclamado, el PDF y accesos al legajo, la asistencia y el banco de horas.
- Se decide **ítem por ítem**: corresponde o no, cuánto se aprueba y, opcionalmente, con qué **concepto** se carga como **novedad** en un período abierto (de su convenio). Conceptos en monto van como importe; en horas o días, como cantidad. "No, lo ajusto a mano" deja solo la respuesta.
- Estado: *aprobado* (todo lo pedido), *aprobado en parte* o *no corresponde*. Si no es todo aprobado, la respuesta es obligatoria (la lee la persona).
- *Motivos*: la lista que ve el empleado, por empresa (nombre, si pide horas/días/importe/descripción, concepto sugerido, activo). Sin lista propia se usa la estándar (`MOTIVOS_ESTANDAR` en `lib/reclamos-reglas.ts`). Cambiarla no toca reclamos ya hechos: cada uno guarda el nombre del motivo.

**Avisos**: mail a RR.HH. (usuarios con Reclamos en "gestionar", de ese sector) cuando entra uno; aviso al empleado cuando se responde, sin importes en el texto.

**Datos**: `ReclamoHaberes` (ítems en JSON con lo pedido y lo decidido, ids de las novedades creadas) y `Empresa.motivosReclamo`. Módulo `reclamos`: RR.HH. completo gestiona, Solo lectura mira; el Supervisor no (son datos de sueldo).

## Buscador de la barra de arriba

Al lado del selector de empresa (`app/Buscador.tsx`, `/api/buscar`). Se abre con **Ctrl+K** o **/**; flechas y Enter para ir.

- **Personas** de la empresa actual por apellido, nombre (sin importar tildes), número de legajo, CUIL o DNI. Solo si el rol tiene Legajos, y el alcance deja solo las de sus sectores. Incluye las de baja (marcadas).
- **Pantallas** del menú que el rol puede ver, por nombre (con 3 letras o más también por categoría y descripción).

`/api/buscar` es ruta "libre" en `lib/permisos.ts`: el filtro por permisos se hace adentro de la ruta.

## Migración

`prisma/migrations/20261013100000_reclamos_haberes`: tabla `ReclamoHaberes`, columna `motivosReclamo` en empresas y el módulo en los roles armados. En producción: `npx prisma migrate deploy` y `npx prisma generate` antes de subir el código.
