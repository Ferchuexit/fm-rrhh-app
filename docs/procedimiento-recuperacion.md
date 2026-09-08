# Procedimiento de recuperación — FM RRHH

Documento de mejora, sección "Backup y recuperación". Dos mecanismos distintos, para dos tipos de problema distintos — no son intercambiables.

## ¿Cuál usar?

| Situación | Usar |
|---|---|
| "Me equivoqué liquidando hace 20 minutos" | **Neon PITR** (instantáneo, sin instalar nada) |
| "Algo se rompió hace 3 días y recién lo noto" | **Neon PITR** — mientras esté dentro de la ventana de tu plan (Free: 6 horas. Ver tabla abajo) |
| "Pasó hace más de la ventana de Neon" | **Backup de `pg_dump`** (`scripts/backup-diario.ps1`) |
| "Necesito una copia de un mes específico de hace tiempo, para auditoría" | **Backup mensual** (`backups/mensuales/`) |

**Ventana de PITR según tu plan de Neon** (verificar en console.neon.tech → Billing, puede cambiar):
- Free: 6 horas, hasta 1 GB de cambios.
- Launch: 7 días.
- Scale: 30 días.

---

## Opción A — Restaurar con Neon PITR (rápido, sin instalar nada)

1. Entrá a [console.neon.tech](https://console.neon.tech), abrí el proyecto.
2. Menú lateral → **Branches**.
3. Elegí tu rama principal → botón **Restore** (o "Create branch" eligiendo un punto en el tiempo, si preferís no tocar la rama principal directamente y primero verificar en una rama nueva — **recomendado**, así no arriesgás nada).
4. Elegí la fecha/hora exacta a la que querés volver.
5. **Antes de dar por bueno el restore**: conectate a esa rama con un cliente de Postgres (o apuntá `DATABASE_URL` ahí temporalmente) y confirmá que los datos se ven como esperabas — un par de liquidaciones conocidas, algún legajo puntual.
6. Recién ahí, si restauraste a una rama nueva, promovela a "main" o actualizá tu `.env` para apuntar ahí.

## Opción B — Restaurar desde un backup de `pg_dump`

**Nunca restaures directo sobre la base de producción sin probar primero.** Los pasos:

1. Creá una rama nueva y vacía en Neon (Branches → Create branch) — esto te da un `DATABASE_URL` limpio para probar, sin tocar producción.
2. Encontrá el archivo `.sql` que necesitás en `backups/diarios/`, `backups/semanales/`, o `backups/mensuales/`.
3. Restaurá ahí (no en producción):
   ```
   psql "<DATABASE_URL de la rama nueva>" -f backups/diarios/fm-rrhh_2026-08-15_0300.sql
   ```
4. Conectate a esa rama y confirmá que los datos están bien.
5. Si todo está bien, ahí decidís: o promovés esa rama a producción, o exportás de vuelta los datos puntuales que necesitabas recuperar (ej. una tabla específica) e importalos a mano en producción.

---

## Pruebas periódicas de restauración

Un backup que nunca se probó restaurar no es un backup, es una esperanza. Poné esto en tu calendario:

- [ ] **Cada 3 meses**: elegí un backup al azar de `backups/mensuales/`, restauralo en una rama de prueba de Neon (Opción B), y confirmá que abre bien y los números de un legajo conocido coinciden con lo que esperás.
- [ ] **Después de cada migración grande de schema** (como la de Decimal): probá una restauración de un backup ANTERIOR a la migración, para confirmar que el procedimiento de recuperación sigue funcionando incluso si el schema cambió.

## Monitoreo del último backup exitoso

`scripts/backup-diario.ps1` escribe `backups/ultimo-backup-exitoso.txt` cada vez que corre bien — con la fecha, hora, y tamaño del archivo. Si ese archivo tiene más de un día de antigüedad, el backup automático dejó de correr — revisá el Programador de Tareas de Windows para ver el error.
