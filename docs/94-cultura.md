# 94 · Cultura: reconocimientos, cumpleaños y aniversarios

Bloque nuevo **Cultura** en el menú. En el portal del empleado, todo vive en
el **Muro**.

## 1. Cumpleaños y aniversarios

Salen solos de la **fecha de nacimiento** y la **fecha de ingreso** del
legajo. No hay nada que cargar.

- **Ese día** (con la tarea diaria de las 9): la persona recibe un saludo, y
  su jefe un aviso para que salude.
- **En el portal**: un cartel en el inicio y la sección "Hoy festejamos" y
  "Próximos festejos" (14 días) en el Muro.
- **Para RR.HH.** (Cultura → Cumpleaños y aniversarios): hoy y los próximos
  30 días a 12 meses, con filtro de **aniversarios redondos** (1, 5, 10,
  15… años), para anticipar un presente. Avisa quién no tiene fecha de
  nacimiento cargada.

Privacidad:

- Del cumpleaños se muestra **día y mes, nunca el año ni la edad**.
- El empleado puede tildar en el Muro **"No mostrar mi cumpleaños"**: deja
  de verse para los compañeros y no se le avisa al jefe. Él igual recibe su
  saludo, y RR.HH. lo sigue viendo (marcado).
- El aniversario se cuenta desde la fecha de ingreso; el día que alguien
  entra no es aniversario. Un 29 de febrero se festeja el 28 en los años no
  bisiestos.

## 2. Reconocimientos

- Cualquier empleado **reconoce a un compañero** desde el Muro: elige a
  quién, por cuál de los **valores de la empresa**, y cuenta **qué hizo**
  (mínimo 15 letras: vale el ejemplo concreto, no el "sos un genio").
- Se publica en el muro **con nombre**, y el reconocido recibe un aviso
  (sin el texto: se lee con el celular bloqueado).
- Los compañeros pueden **aplaudir** 👏.
- **Tope: 5 por persona por mes**, para que no pierda valor. Nadie se
  reconoce a sí mismo.
- **RR.HH.** (Cultura → Reconocimientos) puede reconocer **en nombre de la
  empresa** (sin tope), **ocultar** uno del muro (no se borra) y editar los
  **valores**. Vienen seis de partida: Seguridad, Compañerismo, Calidad,
  Compromiso, Mejora continua, Buena onda.
- Tablero de los últimos 90 días: cuántos, **qué porcentaje de la gente
  recibió al menos uno** (si son siempre los mismos, no está llegando), por
  valor, los más reconocidos y los que más reconocen.

## Permisos

Módulo nuevo **Cultura**: "RR.HH. completo" y "Supervisor" gestionan, "Solo
lectura" ve. Un usuario limitado a sectores ve los reconocimientos y
festejos de su gente; no edita los valores.

## Técnico

- Tablas `ValorEmpresa`, `Reconocimiento`, `AplausoReconocimiento`;
  `Legajo.ocultarCumple`.
- Reglas puras: `lib/cultura-reglas.ts` (`tests/cultura-reglas.test.mjs`);
  base: `lib/cultura.ts`.
- Panel: `/api/reconocimientos`, `/api/celebraciones`. Portal:
  `/portal/muro`, `/api/portal/reconocimientos` (+ `[id]` para aplaudir),
  `/api/portal/preferencias`.
- Los saludos salen en la tarea diaria (`lib/recordatorios.ts`, bloque
  "festejos"): necesita `CRON_SECRET` configurado (ver doc 90).

## Instalación

Trae migración (`cultura`):

```
npx prisma migrate deploy
npx prisma generate
```

## Lo que sigue en Cultura

Eventos, programa de referidos, Beneficios (ex Marketplace) y People
experience.
