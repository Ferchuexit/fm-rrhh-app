# 93 · Puestos, organigrama y reclutamiento

## Qué resuelve

Saber qué puestos tiene la empresa, quién los ocupa y dónde falta gente; y
cubrir esas vacantes sin planillas sueltas ni CV perdidos en un mail.

## 1. Puestos y organigrama (Desarrollo de talento → Puestos y organigrama)

Cada **puesto** tiene: nombre, sector, **de quién depende**, dotación
(cuánta gente debería tener), misión, tareas, requisitos, condiciones y las
**habilidades de la matriz** que pide.

- El organigrama se dibuja solo, como árbol: cada puesto debajo de su
  superior, con quién lo ocupa y cuánta gente tiene por debajo.
- **Vacantes** = dotación − ocupantes. Donde hay, aparece "abrir búsqueda".
- "Perfil → Quién lo ocupa" asigna las personas. Es distinto de la
  categoría de convenio y del "Reporta a" del legajo (que sigue mandando
  para vacaciones, evaluaciones y Mi equipo).
- No deja armar dependencias en círculo.

## 2. Búsquedas (Desarrollo de talento → Reclutamiento)

1. **Nueva búsqueda** eligiendo un puesto: el aviso (título, qué va a
   hacer, requisitos, qué ofrecemos) **sale armado desde el perfil** y se
   retoca. Se guarda como borrador.
2. Se elige **dónde se publica**: página de empleos (gente de afuera),
   búsqueda interna (empleados, desde el portal), o las dos.
3. **Abrir**: empieza a recibir postulaciones. Si es interna, se avisa a
   los empleados.
4. Los candidatos se siguen en un tablero por **etapas**: Postulados →
   Preselección → Entrevista → Preocupacional → Oferta → Contratados /
   Descartados. De cada uno: datos, CV, mensaje, valoración de 1 a 5 y
   notas.
   - Descartar pide el motivo.
   - No deja contratar más gente que las vacantes de la búsqueda.
5. **Contratado → "Cargar su legajo"** abre el alta de legajo con sus datos
   ya cargados. Después, el onboarding de siempre.
6. La búsqueda se **pausa**, se cierra como **cubierta** o se **cancela**.

## 3. Publicación

- Cada búsqueda tiene su **página pública de postulación**
  (`/empleos/<id>`), pensada para el celular: nombre, teléfono o mail,
  localidad, CV en PDF y un mensaje.
- **Aviso listo para pegar** en Computrabajo, Bumeran, ZonaJobs, LinkedIn,
  Indeed, Facebook o WhatsApp: un botón por canal copia el texto completo
  con un enlace propio de ese canal. Así cada candidato queda marcado con
  **de dónde llegó**, y la búsqueda muestra qué canal trae gente y cuál trae
  gente que avanza.
- `/empleos?e=<id de la empresa>` lista todas las búsquedas abiertas de la
  empresa (para poner en la web o en la firma del mail).
- **No hay publicación automática en los portales**: no se verificó que
  ofrezcan una vía abierta para publicar desde otro sistema. Se pega el
  aviso a mano; los candidatos entran solos.

## 4. Base de candidatos

Todos los que se postularon alguna vez quedan guardados. Antes de publicar,
se busca por nombre, localidad, búsqueda anterior o lo que se haya anotado
("tornero", "autoelevador").

## 5. Búsquedas internas

El empleado ve en el portal (**Empleos**) las búsquedas internas y se
postula con un toque; RR.HH. ya tiene sus datos. Figura en el tablero como
"empleado".

## Cuidado con los datos y con la página pública

- La página pública no necesita sesión, así que: muestra **solo el aviso**
  (nada interno del puesto ni de la empresa); solo de búsquedas abiertas y
  marcadas como públicas; valida todo lo que llega; el CV tiene que ser un
  **PDF de verdad** (se miran los primeros bytes) de hasta 4 MB; no duplica
  a quien ya se postuló; tope de 1000 candidatos por búsqueda; y un campo
  trampa para robots.
- El formulario pide **aceptar** que se guarden los datos. "Borrar sus
  datos" elimina al candidato y su CV si lo pide.
- Los CV se guardan en privado (Vercel Blob) y solo se abren con sesión y
  permiso sobre Reclutamiento.
- No hay un listado de todas las empresas: sin el enlace de una empresa, la
  página de empleos no muestra nada.

## Permisos

Módulo nuevo **Puestos y reclutamiento**: "RR.HH. completo" gestiona, "Solo
lectura" ve. El Supervisor no lo recibe. Un usuario limitado a sectores no
crea puestos ni búsquedas.

En el resumen semanal de RR.HH. (lunes) se suma "candidatos nuevos sin
revisar".

## Técnico

- Tablas `Puesto`, `Busqueda`, `Candidato`; `Legajo.puestoId`.
- Reglas puras: `lib/reclutamiento-reglas.ts`
  (`tests/reclutamiento-reglas.test.mjs`); base: `lib/reclutamiento.ts`.
- Rutas públicas por prefijo (`PREFIJOS_PUBLICOS` en `lib/permisos.ts`):
  `/empleos` y `/api/empleos`. Usan el cliente del sistema con filtros
  explícitos.
- `Candidato.empleadoId` va sin relación a Legajo a propósito: un candidato
  es de la búsqueda, no de un sector.

## Instalación

Trae migración (`reclutamiento`):

```
npx prisma migrate deploy
npx prisma generate
```

## Pendiente

- Publicación automática en portales, donde se confirme que se puede.
- Agenda de entrevistas y mails al candidato desde el sistema.
- Usar el puesto en el plan de carrera (hoy es texto libre).
