# FM RRHH — Noticias con acuse de lectura (v1)

Vuelta 79. Primer módulo del área **Comunicación interna**: RR.HH. publica
un comunicado y los empleados lo leen en el portal.

## Qué hay

| Quién | Dónde | Qué hace |
|---|---|---|
| RR.HH. | `/noticias` (menú Comunicación interna) | Publica (título, texto, imagen o PDF opcional), elige destinatarios, ve quién leyó y quién confirmó, exporta la constancia, archiva |
| Empleado | `/portal/noticias` | Lee las suyas; globito de "sin leer" en el inicio y en la barra; confirma lectura si se le pide |

## Reglas

- **Destinatarios**: toda la empresa, o un sector (centro de costo). Un
  empleado sin sector asignado recibe solo las de toda la empresa. Nunca
  cruza de empresa. La definición vive en un solo lugar
  (`esDestinatario` / `filtroDestinatario`), la usan el portal y las
  estadísticas.
- **Leída** = el empleado la abrió. Queda fecha y hora.
- **Confirmación de lectura** (opcional por noticia): un botón, sin PIN —
  es un acuse, no una firma. Queda fecha, hora e IP; el primer acuse es el
  que vale. La noticia sigue contando como pendiente hasta que confirma.
- **Una noticia publicada no se edita.** Si pedía confirmación, la gente
  confirmó ESE texto. Para corregir: archivar y publicar otra.
- **Archivar** la saca del portal sin borrar nada: lecturas y
  confirmaciones quedan como constancia.
- **El texto es plano**: se muestra respetando los saltos de línea, nunca
  como HTML (probado con un `<script>` adentro).
- **Estadísticas**: sobre los destinatarios de HOY (activos del sector). La
  lectura de alguien que después se fue o cambió de sector no infla el
  porcentaje.

## Cómo aplicar esto

```bash
npx prisma migrate deploy   # 2 tablas nuevas (Noticia, NoticiaLectura) — no toca datos existentes
npx prisma generate
```

## Qué falta

- **Aviso fuera del portal** (WhatsApp / mail / push): hoy el empleado se
  entera al entrar. Es lo que más va a pesar en el uso real.
- **Programar** una publicación para más adelante, y fecha de vencimiento.
- **Más de un adjunto**, y formato en el texto (negrita, listas, links).
- **Segmentar por sucursal, convenio o categoría**, no solo por sector.
- **Comentarios y reacciones**: eso ya es "Muro", otro módulo del área.
