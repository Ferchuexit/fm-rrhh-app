# FM RRHH — Legajo digital (v1)

Vuelta 78. La carpeta física del empleado, como checklist: qué tiene, qué
le falta y a quién le toca. Tercera pieza del portal (75: recibos, 76:
vacaciones).

## El checklist

| Ítem | Cómo se completa | Obligatorio |
|---|---|---|
| Ficha de datos personales | La arma el sistema; el empleado la firma con su PIN | Sí |
| DD.JJ. de domicilio | La arma el sistema con el domicilio de la ficha; firma con PIN | Sí |
| Talles de ropa y calzado | Los carga el empleado (o RR.HH. en la ficha) | Sí |
| DNI (frente y dorso) | Foto desde el celular → RR.HH. revisa | Sí |
| Constancia de CUIL | Foto o PDF → RR.HH. revisa | Sí |
| Alta temprana de ARCA | La sube RR.HH. | Sí |
| Notificación de vacaciones | Una por cada vacación vigente; firma con PIN | Sí, si hay vacaciones |
| Certificados de estudios / médicos / otros | Foto o PDF → RR.HH. revisa | No |

## Quién ve qué

| Quién | Dónde | Qué hace |
|---|---|---|
| Empleado | `/portal/legajo` | Firma, sube documentos, carga talles, pide cambios en sus datos, ve y descarga lo suyo |
| RR.HH. | `/legajo-digital` | Bandeja de revisión + checklist de toda la dotación + PDF de las constancias firmadas |

El empleado **nunca** ve la carpeta "disciplinario / legal" de su legajo,
ni listada ni por link directo (probado).

## Las tres reglas acordadas

1. **Los datos personales no se editan directo.** El empleado *propone* el
   cambio (domicilio, localidad, partido, provincia, teléfono, email, estado
   civil) y RR.HH. lo aprueba. Solo esos siete campos: aunque alguien mande
   otro a mano, se ignora (`armarCambios`, con test). Los talles sí son
   libres.
2. **Lo que sube el empleado entra "en revisión"** y no tilda nada hasta
   que RR.HH. lo acepta. Rechazar exige motivo, que el empleado lee.
3. **Disciplinario/legal es solo de RR.HH.**

## La firma se invalida sola cuando cambian los datos

De una constancia firmada no se guarda un PDF: se guarda la foto exacta de
los datos (`ConstanciaFirmada.contenido`) y su huella SHA-256. El estado
sale de comparar esa huella con la de los datos de hoy:

- coincide → **completo**
- no coincide → **firmar de nuevo** (por ejemplo, se aprobó un cambio de
  domicilio: la DD.JJ. vieja queda como antecedente y el portal pide la nueva)

Nadie tiene que acordarse de "pedirle la DD.JJ. otra vez". Y el PDF se arma
a pedido desde la foto guardada, así siempre dice lo que se firmó.

La ficha que se firma lleva **solo datos personales** — a propósito no
incluye categoría, convenio ni talles: cambian seguido y cada cambio
obligaría a volver a firmar.

Al firmar, el navegador manda la huella de lo que se mostró en pantalla; si
RR.HH. tocó algo en el medio, no coincide y se pide revisar de nuevo.

## Archivos

- Fotos o PDF, hasta 3 MB (límite de Vercel). El portal **achica la foto en
  el teléfono** antes de subirla (lado mayor 1800 px): una foto de 10 MB
  viaja como ~400 KB y un DNI se sigue leyendo.
- El tipo se verifica mirando los primeros bytes del archivo, no lo que
  declare el navegador (un HTML renombrado a .jpg se rechaza).
- Mismo destino que ya usaba la ficha: Vercel Blob privado
  (`lib/almacen-documentos.ts`). Solo en `npm run dev`, si Blob no está
  disponible, el archivo cae a la base para poder probar; en producción no.

## Cómo aplicar esto

```bash
npx prisma migrate deploy   # 6 columnas nuevas en DocumentoLegajo + 2 tablas — no toca datos existentes
```

Los documentos ya cargados quedan como "aceptados" y sin tipo: se siguen
viendo en la ficha y en "Otros" del portal, pero no tildan ningún ítem. Si
un DNI ya estaba cargado, hay que volver a subirlo desde `/legajo-digital`
eligiendo el tipo (o pedírselo al empleado).

## Qué falta

- **Datos que el empleado no puede corregir**: fecha de nacimiento, sexo,
  documento, estudios. Si están vacíos, la ficha se firma con "sin cargar".
  Conviene completar las fichas antes de pedir la firma.
- **Reclasificar un documento viejo** (asignarle tipo sin volver a subirlo).
- **Vencimientos** (un certificado o una libreta que caduca).
- **Aviso** a RR.HH. cuando entra algo para revisar, y al empleado cuando
  se lo responden. Hoy se ve al entrar.
- **Certificados médicos → novedad de ausencia**: hoy solo quedan archivados.
- **Alcance legal**: igual que los recibos (doc 75), es firma electrónica,
  no digital. En particular la DD.JJ. de domicilio y la notificación de
  vacaciones son documentos que se suelen pedir en un juicio: que el abogado
  laboralista del cliente valide el criterio antes de dejar el papel.
