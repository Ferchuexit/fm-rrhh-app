# 99 — Tablero de indicadores de Gestión Humana

Indicadores → Tablero de Gestión Humana (módulo de permisos `indicadores`).
**No se carga nada acá**: cada número sale de lo que ya está en los otros
módulos. Filtros: período (últimos 3, 6 o 12 meses) y sector. Se imprime o
se guarda en PDF.

## Qué muestra

| Bloque | Indicadores | De dónde sale |
|---|---|---|
| Dotación y rotación | Dotación, altas y bajas por mes, rotación del período y anualizada, rotación voluntaria, bajas antes de los 90 días, antigüedad promedio, motivos de baja, motivos de la entrevista de salida | Legajos (ingreso/egreso) y Offboarding |
| Ausentismo | Tasa, días por motivo (sin aviso, con aviso, enfermedad, ART, suspensión) por mes, por sector, puntualidad, quiénes concentran las faltas, **licencias prolongadas** (10 días corridos o más de enfermedad o ART) | Calendario de Asistencia |
| Vacaciones | Cuántos están afuera hoy, cuántos salen en 30 días, el día con más gente afuera, pedidos sin responder | Vacaciones y Solicitudes |
| Clima | % de respuestas favorables, eNPS, participación, por tema (de peor a mejor), evolución entre encuestas | Encuestas cerradas |
| Documentación | % de legajos completos, avance total, qué espera al empleado y qué a RR.HH., avance por documento | Legajo digital |
| Capacitación | Realizadas, asistencia, % de la dotación capacitada, horas por empleado, constancias sin firmar, habilitaciones vencidas y por vencer | Capacitaciones y Habilidades |
| Ingresos y egresos | En curso, tareas a tiempo, tareas vencidas (y de quién), días para completar, % con entrevista de salida, recontratables | Onboarding y Offboarding |
| Vacantes y reclutamiento | Vacantes por puesto, búsquedas abiertas, tiempo de cobertura, hasta dónde llegan los candidatos, de dónde llegan | Puestos y Reclutamiento |
| Desempeño y cultura | Evaluaciones completadas y firmadas, objetivos cumplidos y vencidos, gente reconocida, uso del portal | Evaluaciones, Objetivos, Reconocimientos, Accesos |

Arriba de todo, seis números con semáforo y **"Para mirar"**: lo que el
tablero señala solo (lo crítico primero), con el enlace a donde se resuelve.

## Cómo se calcula

- **Rotación** = bajas del período / dotación promedio (la del comienzo y
  la del final). La *anualizada* la lleva a 12 meses para comparar un
  trimestre con un año. Una baja sin fecha de egreso no entra (se avisa).
- **Ausentismo** = días con falta, enfermedad, ART o suspensión / días que
  había que trabajar. Francos, feriados, vacaciones y licencias pagas no
  cuentan ni arriba ni abajo.
- **Clima** = promedio del % de respuestas "De acuerdo" y "Muy de acuerdo"
  por tema. No se abre por sector desde acá (anonimato).
- **Sin datos no es cero**: un indicador que no se puede calcular muestra
  "—" y no dispara alertas.

## Referencias del semáforo

Orientativas, en un solo lugar (`REFERENCIAS` en `lib/indicadores-reglas.ts`):
rotación anual hasta 15 %, ausentismo hasta 3 %, clima 70 % favorable,
documentación 90 % de legajos completos, asistencia a capacitaciones 90 %,
tareas a tiempo 85 %. Pendiente: que cada empresa las ajuste desde pantalla.

## Lo que todavía no se puede medir

- **Entrega de EPP**: no hay registro de entregas (solo una tarea en el
  ingreso). Hace falta el módulo.
- Sanciones que no sean suspensión (apercibimientos): no hay registro.
- Saldo de vacaciones pendientes por persona en el tablero.

## Código

`lib/indicadores-reglas.ts` (puro, `tests/indicadores-reglas.test.mjs`),
`lib/indicadores.ts` (lee de cada módulo; cada bloque en su try),
`app/api/indicadores`, `app/indicadores`. Gráficos con recharts: un solo
eje por gráfico, leyenda cuando hay más de una serie, "Ver datos" con la
tabla, y los colores de estado reservados al semáforo (siempre con ícono y
palabra). Un usuario limitado a sectores ve los indicadores de su gente.
