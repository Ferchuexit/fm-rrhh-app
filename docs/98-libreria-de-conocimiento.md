# 98 — Librería de conocimiento

Lo que la gente tiene que poder consultar cuando lo necesita, desde el
celular: el reglamento, un procedimiento de seguridad, el instructivo de
una máquina, una pregunta frecuente. Módulo de permisos `biblioteca`
(Comunicación interna → Librería de conocimiento).

## Un artículo

Título, categoría y al menos una de estas tres cosas:

- **Texto** escrito ahí mismo (lo que mejor se lee en un celular).
- **Archivo**: PDF o imagen, hasta 4 MB.
- **Enlace**: si es un video de YouTube, se ve dentro del portal.

Además: para qué sectores es (o toda la empresa) y si es **destacado**
(aparece arriba, en "Lo más importante").

Estados: borrador → publicado → archivado. Solo lo publicado se ve en el
portal. Al publicar se puede avisar a quienes les corresponde. Un publicado
no se borra directo: se archiva primero.

## Categorías

Es texto libre, con sugerencias para arrancar: Reglamento y normas,
Seguridad e higiene, Procedimientos, Máquinas e instructivos, Calidad,
Preguntas frecuentes, Formularios. Con la librería vacía, la pantalla
muestra qué va en cada una.

## En el portal

Portal → Librería (el botón aparece cuando hay algo publicado). Destacados
arriba, después por categoría, y un **buscador**:

- ignora tildes y mayúsculas;
- busca en el título (lo que más pesa), la categoría, el texto y **lo que
  dice el PDF por dentro** (se extrae al subirlo; un PDF escaneado como
  foto no tiene texto y se encuentra solo por título);
- tienen que aparecer todas las palabras buscadas;
- muestra el fragmento donde lo encontró.

Si no encuentra nada, ofrece preguntarle a RR.HH. por el chat.

## Quién lo abrió

Al abrir un artículo queda anotado quién y cuándo. RR.HH. ve "lo abrieron
12 de 40" y la lista persona por persona. **No es constancia de lectura**:
para eso están las Noticias con confirmación. Lo recomendado para un
reglamento nuevo: Noticia con confirmación para comunicarlo, y el artículo
en la Librería para consultarlo después.

## Código

`lib/biblioteca-reglas.ts` (puro, `tests/biblioteca-reglas.test.mjs`),
`lib/biblioteca.ts`, `app/biblioteca`, `app/api/biblioteca`,
`app/portal/biblioteca`, `app/api/portal/biblioteca`. Tablas
`ArticuloBiblioteca` y `LecturaBiblioteca`. Los archivos van al
almacenamiento privado y solo se sirven con sesión.

## Pendiente / ideas

- Archivos de más de 4 MB (hoy hay que achicarlos o partirlos).
- Sumar artículos de la Librería como paso del onboarding ("leé el
  reglamento").
- Varias fotos o pasos con imagen en un mismo instructivo.
