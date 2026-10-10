# 89 · Objetivos y plan de carrera · autoevaluación · planilla PDF

Tres piezas que cierran "Desarrollo de talento".

## 1. Objetivos

Qué se espera de cada persona y para cuándo.

- **Quién los carga**: RR.HH. desde **Desarrollo de talento → Objetivos y
  plan de carrera** (para uno o varios a la vez: cada uno recibe su copia),
  o el **jefe desde el portal** (Objetivos → De mi equipo), solo para quien
  le reporta directo.
- **Avance** (0 a 100 % + comentario): lo informa el **empleado** desde el
  portal, su jefe o RR.HH.
- **Cierre**: *cumplido*, *no cumplido* (obliga a escribir por qué) o
  *cancelado*. Lo cierra el jefe o RR.HH.; **nunca el propio empleado**.
  RR.HH. puede reabrirlo.
- Semáforo: *vencido* si pasó la fecha, *por vencer* si faltan 15 días o
  menos.
- Arriba de la pantalla: objetivos en curso, vencidos sin cerrar y
  **% de cumplimiento** (cumplidos sobre cerrados; los cancelados no
  cuentan).
- Avisos: al asignar un objetivo y al cerrarlo (sin el texto del objetivo).

## 2. Plan de carrera

Uno por persona: **a qué puesto apunta**, para cuándo, notas, y **qué
habilidades de la matriz pide ese puesto** (con el nivel).

La **brecha se calcula sola** contra la matriz de habilidades: muestra qué
tiene y qué le falta. Una habilidad vencida cuenta como faltante. Cuando se
cierra una capacitación que habilita en eso, el plan se actualiza sin tocar
nada. El empleado lo ve en el portal (Objetivos → Mi plan de carrera).

## 3. Autoevaluación y comparación (Evaluación de desempeño)

- Al abrir un ciclo se puede tildar **Pedir autoevaluación**. Cada evaluado
  recibe un aviso y se puntúa en las mismas competencias desde el portal.
  La puede corregir hasta que le entreguen su evaluación.
- El **jefe la ve** al evaluar ("se puso 4") y RR.HH. en el panel, con las
  diferencias de 2 puntos o más marcadas en rojo. No es obligatoria para
  que el jefe complete.
- El empleado **nunca ve lo que cargó el jefe** hasta la entrega.
- **Comparación**: cada evaluación muestra el promedio de la **evaluación
  anterior** de esa persona y si subió o bajó.

## 4. Planilla de capacitación en PDF

En cada capacitación, enlace **Planilla PDF**:

- **Programada**: lista de convocados con la columna de firma en blanco,
  para firmar en papel el día que se dicta.
- **Realizada**: además, presente/ausente y quién la **confirmó en el
  portal** (fecha y hora). Con lugar para la firma de quien la dictó y del
  responsable de la empresa.

## Permisos

Módulo nuevo **Objetivos y plan de carrera**: "RR.HH. completo" y
"Supervisor" gestionan, "Solo lectura" ve. Quien está limitado a sectores
ve y carga solo para su gente.

## Técnico

- Tablas `Objetivo`, `PlanCarrera`; columnas `conAutoevaluacion` (ciclo) y
  `autoPuntajes`, `autoComentario`, `autoCompletadaEn` (evaluación).
- Reglas puras: `lib/objetivos-reglas.ts` (`tests/objetivos-reglas.test.mjs`).
  Base: `lib/objetivos.ts` (lo usan panel y portal).
- PDF: `lib/capacitacion-pdf.ts`, `/api/capacitaciones/[id]/planilla`.

## Instalación

Trae migración (`objetivos_autoevaluacion`):

```
npx prisma migrate deploy
npx prisma generate
```
