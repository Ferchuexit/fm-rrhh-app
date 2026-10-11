# 95 — Cultura: eventos y programa de referidos

Segunda parte de Cultura (la primera está en `94-cultura.md`). Las dos
viven en el módulo de permisos `cultura` y en la categoría **Cultura** del
menú.

## Eventos

Lo que la empresa organiza para su gente: el asado de fin de año, una
charla, una jornada, una campaña.

**RR.HH. (Cultura → Eventos)**

1. Carga el evento: nombre, día, hora, lugar, detalle y para quiénes (toda
   la empresa o algunos sectores). Queda como **borrador**.
2. Opcional: pedir confirmación (viene marcado), fecha límite para
   confirmar, cupo y cuántos acompañantes puede llevar cada uno. Si se
   desmarca "pedir que confirmen", es solo un anuncio.
3. **Publicar y avisar**: lo ven los invitados en el portal y les llega el
   aviso.
4. En la tarjeta se ve con cuántos contar (van, acompañantes, no van, sin
   responder) y, al abrirla, persona por persona. RR.HH. puede anotar a
   mano a quien avisó de palabra.
5. El día del evento o después se puede marcar **quién fue**.
6. Un evento publicado se puede editar (si cambia día, hora o lugar se
   avisa a los invitados) o **cancelar** (también se avisa). Un publicado no
   se borra: se cancela, así la gente se entera.

**Empleado (Portal → Eventos)**

Ve los eventos que vienen y toca **Voy** o **No puedo ir**. Puede cambiar
de opinión mientras esté abierta la confirmación. El cupo cuenta también a
los acompañantes; decir que no siempre se puede.

**Recordatorios automáticos** (tarea diaria, ver `90`):

- el día anterior, a los que dijeron que van (o a todos los invitados, si
  el evento no pide confirmación);
- a quien no respondió, 2 días antes de que cierre la confirmación y el
  último día.

Reglas en `lib/eventos-reglas.ts` (tests en `tests/eventos-reglas.test.mjs`),
base de datos en `lib/eventos.ts`. Tablas `Evento` y `AsistenciaEvento`.
Un usuario limitado a sectores ve los eventos y puede anotar respuestas de
su gente, pero no crear, publicar ni cancelar.

## Programa de referidos

Los empleados recomiendan gente para las búsquedas abiertas.

- Se activa **por búsqueda**: Reclutamiento → Editar el aviso → "Aceptar
  referidos de los empleados", con un premio opcional en texto libre ("un
  día libre", "una orden de compra"). Una búsqueda puede ser solo por
  referidos, sin página pública.
- Al abrir la búsqueda se les avisa a los empleados (si además es interna,
  sale un solo aviso, el de búsqueda interna).
- **Portal → Recomendá**: el empleado carga nombre, un contacto, de dónde
  la conoce, por qué la recomienda y, si lo tiene, el CV en PDF. Tiene que
  marcar que la persona está de acuerdo en que pase sus datos. Tope: 5
  recomendados por búsqueda por empleado.
- El recomendado entra a Reclutamiento como un candidato más, fuente
  "Referido", con el nombre de quien lo recomendó. **Pasa por el mismo
  proceso**: recomendar suma, no asegura. No se le hacen las preguntas de
  filtro (nadie las contesta por otro); las palabras clave sí se buscan en
  el CV.
- Quien recomendó ve en el portal cómo sigue, resumido: *recibido*, *en
  proceso*, *ingresó* o *no avanzó esta vez*. Nunca la etapa exacta ni el
  motivo del descarte. Si su recomendado ingresa, le llega un aviso (sin el
  nombre: se lee con el celular bloqueado).
- **Cultura → Programa de referidos**: cuántos se recomendaron, cuántos
  ingresaron, quiénes recomiendan, y los premios por entregar (se tildan
  cuando se entregan; solo por alguien que ya ingresó).

Reglas en `lib/referidos-reglas.ts` (tests en
`tests/referidos-reglas.test.mjs`). No hay tabla nueva: son columnas en
`Busqueda` (`referidos`, `premioReferido`) y en `Candidato`
(`referidoPorId`, `referidoPorNombre`, `relacionReferido`,
`premioReferidoEn`).

## Pendiente / a decidir

- Cuándo se gana el premio: hoy se puede marcar apenas el recomendado
  ingresa. Muchas empresas lo entregan recién al pasar el período de prueba;
  si se quiere, se agrega un plazo.
- Fotos del evento en el Muro.
