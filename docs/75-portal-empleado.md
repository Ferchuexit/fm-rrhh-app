# FM RRHH — Portal del Empleado: acceso con ID y recibos con firma (v1)

Vuelta 75. Primer módulo de la ampliación hacia plataforma de Gestión
Humana: hasta acá el sistema solo tenía usuarios internos (admin, operador,
lectura). Ahora el **empleado** entra desde su celular, ve sus recibos y los
firma. Es la base sobre la que se montan vacaciones, legajo digital y
noticias.

## Qué hay

| Quién | Dónde | Qué hace |
|---|---|---|
| Empleado | `/portal` | Entra con CUIL o DNI + PIN de 6 números, ve sus recibos, baja el PDF, firma en conformidad o disconformidad |
| RR.HH. | `/accesos-portal` | Genera el PIN temporal (uno o toda la dotación), lo resetea, desactiva un acceso |
| RR.HH. | `/firmas-recibos` | Por período: quién vio, quién firmó, observaciones de disconformidad; exporta la constancia |

## Dos sesiones separadas — la decisión que define todo

El empleado **no** es un `Usuario` con rol nuevo. Tiene su propio modelo
(`AccesoPortal`), su propia cookie (`sesion_portal`) y su token se firma con
una clave derivada distinta (`lib/portal-edge.ts`).

El motivo: las ~100 rutas de `/api` que ya existen asumen que quien tiene la
cookie `sesion` puede ver a toda la dotación (por ejemplo `/api/recibo`
entrega el recibo de cualquier `legajoId`). Con un "rol empleado" sobre la
misma cookie, cada una de esas rutas hubiera quedado a un olvido de mostrarle
a un operario el recibo de un compañero. Separando las sesiones, ninguna ruta
vieja deja pasar a un empleado, y no hubo que tocarlas.

En `middleware.ts`, todo `/portal` y `/api/portal` se resuelve en un bloque
aparte que siempre retorna. Se probó cruzando las cookies a mano: el token
del empleado puesto como `sesion` da 401, y el del admin puesto como
`sesion_portal` también.

## El PIN

- 6 números. Se rechazan iguales (111111), en escalera (123456) y los que
  son parte del propio CUIL/DNI. Reglas en `lib/portal-pin.ts`, con tests.
- RR.HH. genera un PIN **temporal**; se muestra una sola vez (en la base
  queda el hash bcrypt). En el primer ingreso el sistema obliga a elegir uno
  propio y hasta entonces no deja ver nada: así quien generó el PIN no puede
  entrar a firmar por el empleado.
- 5 intentos fallidos → 15 minutos de bloqueo (mismo criterio que `/api/login`).
- Desactivar un acceso corta también la sesión que ya estuviera abierta.

## Qué recibos se ven

Solo la liquidación **vigente** de períodos en estado **`cerrada`**. Mientras
el período está en borrador el empleado no ve nada; si se reabre, deja de
verse hasta que se vuelva a cerrar. No hay un paso de "publicar": cerrar en
`/auditoria` publica.

## La firma

`ReciboDigital` cuelga de `Liquidacion` (no de período + legajo): si el
período se vuelve a liquidar, la versión nueva necesita firma nueva y la
anterior queda como antecedente.

Al firmar se vuelve a pedir el PIN y se guarda: tipo, fecha y hora, IP,
navegador y un SHA-256 del **contenido** del recibo (no del PDF: pdf-lib le
pone fecha de creación a cada archivo y el hash cambiaría siempre). Firmar en
disconformidad exige escribir el motivo. No existe ninguna pantalla ni ruta
que edite o borre una firma.

Las dos rutas que borran liquidaciones (`DELETE /api/liquidar` y el borrado
forzado de un concepto) ahora se frenan con un mensaje claro si alguna tiene
el recibo firmado.

## ⚠️ Alcance legal — leer antes de venderlo como "firma digital"

Esto es **firma electrónica** (Ley 25.506, art. 5), no firma digital con
certificado. Sirve como constancia de entrega y conformidad, pero si el
empleado la desconoce, quien tiene que probar que es válida es el empleador.
Antes de reemplazar el papel firmado en un cliente, que su abogado laboralista
confirme el criterio y el estado vigente de la reglamentación del art. 140
LCT (ver `06-recibo-ley-27802.md`).

## Cómo aplicar esto

```bash
npm install
npx prisma migrate deploy     # crea AccesoPortal y ReciboDigital — no toca datos existentes
npm run dev
```

En Vercel: la migración tiene que correr contra la base de producción antes
(o junto con) el deploy. No hay variables de entorno nuevas.

## Cómo probarlo

1. `/accesos-portal` → "Dar acceso" a un legajo. Anotá el PIN temporal.
2. En una ventana de incógnito: `/portal`, entrá con el DNI y ese PIN. Te
   obliga a elegir uno propio.
3. Si el período no está cerrado, no aparece ningún recibo — es lo esperado.
   Cerralo en `/auditoria` y recargá.
4. Abrí el recibo, mirá el PDF, firmá.
5. `/firmas-recibos` → debería figurar como firmado, con fecha y hora.

## Qué falta

- **Recibos de Docentes PBA** (`DocLiquidacion`): no aparecen en el portal,
  solo los del motor general.
- **Verificación de la huella en pantalla**: el hash se guarda al firmar,
  pero todavía no hay un botón que lo recalcule y avise si el recibo cambió
  después. Hoy se puede comprobar exportando la constancia.
- **Aviso al empleado** de que hay un recibo nuevo (mail / WhatsApp).
- **Recuperar el PIN sin pasar por RR.HH.**
- **Bitácora de quién generó cada PIN**: se guarda el último (`generadoPor`),
  no el historial.
- Las rutas internas `/api/recibo` y `GET /api/legajos/[id]/documentos` no
  verifican que el legajo sea de una empresa autorizada para el usuario
  (preexistente, no es del portal). Hoy no molesta porque los usuarios son de
  la consultora; hay que cerrarlo antes de darle un usuario operador a un
  cliente.
- Siguientes piezas del portal: vacaciones y permisos, legajo digital,
  noticias.
