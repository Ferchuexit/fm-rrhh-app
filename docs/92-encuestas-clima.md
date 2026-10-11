# 92 · Encuestas de clima

## Qué resuelve

Medir el clima laboral con encuestas **anónimas** que la gente responde
desde el celular, y leer los resultados por tema (dimensión) y por sector.

## Cómo se usa

1. **Desarrollo de talento → Encuestas de clima → Nueva encuesta**, a partir
   de una plantilla:
   - **Clima laboral** (16 preguntas): liderazgo, comunicación, condiciones
     y seguridad, reconocimiento, crecimiento, compañerismo, la pregunta de
     recomendación (eNPS) y dos de texto libre.
   - **Pulso** (5 preguntas), para repetir seguido.
   - O en blanco.
2. Se elige hasta cuándo se responde y para quién (toda la empresa o
   algunos sectores). Queda como **borrador**; se puede editar.
3. **Abrir y avisar**: les llega el aviso a los destinatarios. Desde ahí no
   se cambian las preguntas.
4. El empleado responde en el portal (**Encuestas**). El sistema recuerda a
   quien falta 2 días antes del cierre y el último día.
5. Se cierra sola en la fecha, o antes con **Cerrar ahora**. Recién ahí
   aparecen los resultados.
6. **Repetir** copia la encuesta para volver a hacerla y comparar.

Tipos de pregunta: de acuerdo/en desacuerdo (1 a 5), recomendación (0 a
10), elegir una opción, texto libre (opcional para quien responde).

## Cómo se cuida el anonimato

- **Dos tablas sin nada que las una**: una guarda *quién ya respondió* (para
  que no responda dos veces y para recordarle a quien falta) y otra *qué se
  respondió*, sin persona y **sin fecha ni hora**. Ni un administrador
  mirando la base puede unir una con la otra.
- **Resultados solo con la encuesta cerrada.** Mientras está abierta se ve
  cuántos respondieron, nada más: mirar los resultados a medida que entran
  permitiría deducir qué contestó cada uno.
- **Mínimo 5 respuestas** para mostrar cualquier resultado. Y no se puede
  abrir una encuesta que le llegue a menos de 5 personas.
- **Por sector**, solo los que tienen 5 o más. Si los sectores chicos suman
  entre todos menos de 5, no se abre por sector para nadie (restando del
  general se podría deducir al sector chico).
- Los **comentarios** salen mezclados, no en el orden en que se escribieron.
- Una respuesta enviada **no se puede corregir**: no queda registro de cuál
  es la de cada uno.

## Qué muestran los resultados

Participación (general y por sector), promedio general de 1 a 5, % de
respuestas favorables (de acuerdo o muy de acuerdo), **eNPS** (% que
recomienda con 9-10 menos % que no, con 0-6; va de −100 a +100), promedio
por **dimensión** ordenado de peor a mejor, por sector, y pregunta por
pregunta con su distribución y los comentarios.

## Permisos

Módulo nuevo **Encuestas de clima**: "RR.HH. completo" gestiona, "Solo
lectura" ve. El Supervisor no lo recibe. Un usuario limitado a sectores no
crea ni abre encuestas.

## Técnico

- Tablas `Encuesta`, `ParticipacionEncuesta`, `RespuestaEncuesta`.
- Reglas puras y cálculo de resultados: `lib/encuestas-reglas.ts`
  (`tests/encuestas-reglas.test.mjs`).
- Panel: `/api/encuestas`, `/api/encuestas/[id]`. Portal:
  `/portal/encuestas`, `/api/portal/encuestas/[id]`.
- El cierre automático y el recordatorio corren en la tarea diaria
  (`lib/recordatorios.ts`).

## Instalación

Trae migración (`encuestas`):

```
npx prisma migrate deploy
npx prisma generate
```
