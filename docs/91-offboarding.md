# 91 · Offboarding

## Qué resuelve

El espejo del onboarding: cuando alguien deja la empresa, una lista de
pasos repartida entre **RR.HH.** y su **jefe**, con vencimientos contra el
último día de trabajo. Y la **entrevista de salida**, que es lo que después
explica la rotación.

## Cómo se usa

1. **Gestión de RR.HH. → Offboarding → Iniciar un egreso**: quién se va,
   último día de trabajo, motivo (renuncia, despido sin/con causa, fin de
   contrato o período de prueba, mutuo acuerdo, jubilación, fallecimiento,
   otro) y plantilla.
2. Se crea la lista de tareas. Las del **jefe** (traspaso, recibir
   herramientas) las ve y las tilda en el portal, en **Mi equipo**.
3. RR.HH. carga la **entrevista de salida**: motivo real por el que se va,
   si la empresa lo volvería a tomar, y comentario.
4. Cuando no queda nada pendiente, el egreso se cierra solo.

## Lo que se tilda solo

| Tarea | Se tilda cuando… |
| --- | --- |
| Reasignar a la gente que tenía a cargo | nadie activo le reporta |
| Reasignar sus evaluaciones | no le quedan evaluaciones de su equipo por completar |
| Responder sus pedidos pendientes | no tiene pedidos de vacaciones o permisos sin responder |
| Cerrar sus objetivos | no tiene objetivos en curso |
| Entrevista de salida | se cargó la entrevista |
| Dar de baja el legajo | en Legajos figura con condición «Baja» y fecha |
| Cerrar su acceso al portal | el acceso está desactivado |

## Reglas

- **Iniciar el egreso no da de baja el legajo ni cierra el portal.** Son
  tareas de la lista: la baja toca la liquidación final y se hace en
  Legajos, como siempre.
- **A quien se va no se le avisa nada.** Al jefe le llega un aviso que no
  nombra a la persona ni dice «egreso» (se lee con el celular bloqueado, y
  la salida puede no estar comunicada todavía).
- La entrevista de salida **no se ve desde el portal**: ni el jefe ni la
  persona.
- Los días de la plantilla son un **orden sugerido, no plazos legales**.
- Un egreso cancelado (la persona se queda, o se cargó por error) no se
  borra y no cuenta en la rotación.
- Se puede cargar un egreso que ya pasó (hasta un año atrás), para dejar el
  registro: la pantalla sugiere a quienes ya figuran de baja.

## Rotación

Arriba de la pantalla, de los últimos 12 meses: cuántas salidas (y qué
porcentaje de la dotación actual), cuántas por decisión de la persona,
cómo terminaron, **por qué se fueron** según las entrevistas, y a cuántos
la empresa volvería a tomar.

## Permisos

Entra en el módulo **Legajo digital**, igual que Onboarding: quien ya lo
tenía, ve Offboarding. Un usuario limitado a sectores ve los egresos de su
gente y no edita las plantillas.

## Técnico

- Tablas `PlantillaEgreso`, `Egreso`, `TareaEgreso`.
- Reglas puras: `lib/egresos-reglas.ts` (`tests/egresos-reglas.test.mjs`);
  base: `lib/egresos.ts`. Reutiliza avance y vencimientos del onboarding.
- Panel: `/api/offboarding` (+ `[id]`, `plantillas`, `tareas/[id]`).
  Portal: `/api/portal/egreso/tareas/[id]` y
  `app/portal/equipo/TareasEgreso.tsx`.

## Instalación

Trae migración (`offboarding`):

```
npx prisma migrate deploy
npx prisma generate
```
