# 88 · Evaluación de desempeño

## Qué resuelve

La evaluación de cada persona la hace **su jefe directo desde el celular**,
RR.HH. la revisa y recién entonces se la **entrega al empleado**, que la lee
y la **firma** (conforme o en disconformidad). Queda el historial por ciclo,
con promedios por competencia.

## Cómo se usa

1. **Desarrollo de talento → Evaluación de desempeño → Abrir ciclo**: nombre,
   formulario, fecha límite para los jefes y a quién se evalúa (todos, por
   sector o uno por uno).
2. A cada jefe le llega **un aviso** con cuántas evaluaciones tiene. Las
   completa en el portal (**Evaluaciones**): nota de 1 a 5 por competencia,
   fortalezas y a mejorar. Puede guardar un borrador.
   - Quien **no tiene jefe cargado** ("Reporta a" en el legajo) queda para
     que lo evalúe RR.HH. desde el panel.
   - Una nota de 1 o 2 obliga a escribir algo en "A mejorar".
3. RR.HH. ve el avance, abre cada evaluación, la puede **corregir**,
   **devolver al jefe** o **entregar** (una, o todas las completadas).
4. Al entregarla, el empleado recibe un aviso (sin el resultado: se lee con
   el celular bloqueado), la ve en el portal y **firma**. En disconformidad
   tiene que contar por qué; RR.HH. lo ve en el panel.
5. **Cerrar ciclo**: los jefes ya no cargan ni corrigen. Lo entregado se
   puede seguir firmando. Se puede reabrir.

## Reglas

- **El empleado no ve nada hasta la entrega.** Ni el borrador ni la
  evaluación completada.
- **Entregada no se modifica**: es lo que el empleado leyó y firmó.
- Evalúa el jefe que cada uno tenía **al abrir el ciclo**.
- El ciclo guarda **su copia del formulario**: editar un formulario no
  cambia los ciclos ya abiertos.
- Escala: 1 No cumple · 2 Cumple en parte · 3 Cumple · 4 Supera ·
  5 Sobresaliente. El promedio es simple (todas las competencias pesan
  igual).
- La primera vez se crea solo el formulario **"Personal de planta"** (7
  competencias). Se edita o se agregan otros desde la misma pantalla.

## Permisos

Módulo nuevo **Evaluación de desempeño**. La migración se lo da a "RR.HH.
completo" (gestionar) y a "Solo lectura" (ver). Al **Supervisor no**: ve las
notas de todos; si se quiere, se le agrega desde Roles. Un usuario limitado
a sectores ve y entrega solo las de su gente, y no abre ciclos ni edita
formularios.

## Técnico

- Tablas `FormularioEvaluacion`, `CicloEvaluacion`, `Evaluacion`.
- Reglas puras en `lib/evaluaciones-reglas.ts`
  (`tests/evaluaciones-reglas.test.mjs`); base en `lib/evaluaciones.ts`.
- Panel: `/api/evaluaciones`, `/api/evaluaciones/[id]`,
  `/api/evaluaciones/evaluacion/[id]`, `/api/evaluaciones/formularios`.
- Portal: `/portal/evaluaciones`, `/api/portal/evaluaciones/[id]` (quién
  puede qué sale de la sesión: evaluador o evaluado).

## Instalación

Trae migración (`evaluaciones`):

```
npx prisma migrate deploy
npx prisma generate
```

## Pendiente

- Autoevaluación y evaluación 360°.
- Comparar un ciclo con el anterior por persona.
- Objetivos y plan de carrera (siguiente pieza).
