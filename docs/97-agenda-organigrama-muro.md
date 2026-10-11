# 97 — Agenda, organigrama en el portal y publicaciones del muro

## Agenda

Un calendario que **no guarda nada propio**: junta lo que ya tiene fecha en
los otros módulos.

| Qué | De dónde sale |
|---|---|
| Eventos | Cultura → Eventos |
| Capacitaciones | Desarrollo de talento → Capacitaciones |
| Feriados | Los feriados cargados de la empresa |
| Vacaciones | Las vacaciones notificadas |
| Permisos | Solicitudes de permiso aprobadas (sin el motivo) |
| Cumpleaños y aniversarios | Fecha de nacimiento e ingreso del legajo (nunca la edad) |
| Fechas límite | Cierre de encuestas, vencimiento de evaluaciones, último día para confirmar un evento |

- **Panel (Comunicación interna → Agenda)**: vista de mes, filtros por
  tipo, detalle del día al costado, y en cada día cuánta gente está afuera
  (vacaciones + permisos). Módulo de permisos `agenda`. Un usuario limitado
  a sectores ve las vacaciones y permisos solo de su gente. Ojo: quien
  tenga Agenda ve quién está de vacaciones aunque no tenga el módulo
  Vacaciones.
- **Portal (Agenda)**: los próximos dos meses en lista. Lo propio
  (vacaciones, permisos, capacitaciones donde está anotado, eventos que le
  corresponden y si confirmó), lo de su equipo si tiene gente a cargo, y lo
  de todos (feriados, festejos, respetando a quien no muestra su cumpleaños).

Código: `lib/agenda-reglas.ts` (puro), `lib/agenda.ts`. Cada fuente va en su
try: si una falla, el resto se muestra.

## Organigrama en el portal

Portal → Organigrama. Arriba, **"Tu lugar"**: puesto, sector, a quién
reporta, quiénes reportan al mismo jefe y a quiénes tiene a cargo. Abajo,
la empresa: si se cargaron puestos (Desarrollo de talento → Puestos), el
árbol de puestos con quién ocupa cada uno y las vacantes; si no, el árbol
de personas según el jefe de cada legajo (`lib/organigrama-reglas.ts`).
Solo nombres, puestos y sectores. Si los mensajes entre compañeros están
activos, tocar un nombre abre el chat con esa persona.

## Publicaciones del muro

El muro mezcla ahora reconocimientos y **publicaciones** (texto y/o una
foto), lo más nuevo arriba.

- El empleado publica desde Portal → Muro. La foto se achica en el celular
  antes de subir (lado máximo 1600 px): las de la cámara pesan más de los
  4 MB que acepta el servidor. Tope: 5 publicaciones por día por persona.
- **Me gusta** y **comentarios**. Cada uno borra lo suyo. Al autor le llega
  una notificación al celular cuando le comentan (sin el texto).
- **RR.HH. (Cultura → Publicaciones del muro)**: publica como empresa,
  oculta publicaciones o comentarios, y decide con un tilde si lo que
  publican los empleados **espera aprobación** antes de salir. Lo pendiente
  lo ve solo su autor, con el cartel.
- Las fotos se guardan en el almacenamiento privado (Vercel Blob) y solo
  se sirven a quien tiene sesión en esa empresa.

Código: `lib/muro-reglas.ts` (puro), `lib/muro.ts`. Tablas `Publicacion`,
`MeGustaPublicacion`, `ComentarioPublicacion`; `Empresa.muroConAprobacion`.

Tests de las tres piezas: `tests/agenda-reglas.test.mjs`.

## No verificado en producción

La subida y la lectura de fotos contra Vercel Blob (en la prueba se usó el
plan B de desarrollo), y el achicado de fotos en un celular real.

## Agregado: fechas clave y organigrama en el panel

- **Agregar a la agenda** (botón en Comunicación interna → Agenda): para lo
  que no sale de ningún módulo — una entrega, una auditoría, una reunión,
  una visita, una parada de mantenimiento. Se elige qué es, título, día,
  hora, lugar, detalle y a quiénes les corresponde. Queda publicado al
  momento, lo ven todos en la agenda del panel y del portal (tipo "Fechas
  clave", en naranja), se puede avisar en el acto y **el día anterior se
  les recuerda solo**.
  Por dentro es un `Evento` con `categoria` distinta de `social` y sin
  pedido de confirmación; por eso se edita o cancela en Cultura → Eventos.
  Un usuario limitado a sectores no puede agregar fechas de toda la empresa.
- **Organigrama en el panel** (Comunicación interna → Organigrama, módulo
  `organigrama`, solo consulta): vista por puestos (ocupantes, dotación,
  vacantes) y por personas (quién reporta a quién), con buscador e
  impresión. Se edita en Puestos y en el legajo.
