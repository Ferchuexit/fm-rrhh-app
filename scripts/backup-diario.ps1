# FM RRHH — scripts/backup-diario.ps1
#
# Backup real de la base (pg_dump), para complementar el Point-in-Time
# Restore de Neon — en el plan Free, esa ventana es de solo 6 horas, muy
# poco margen para datos de sueldos de un cliente real. Esto no reemplaza
# a Neon (seguís teniendo esas 6 horas para revertir algo puntual al
# instante), es una red de seguridad ADICIONAL, con retención más larga,
# gratis, corriendo en tu propia máquina.
#
# Qué hace cada vez que corre:
#   1. Lee DATABASE_URL de .env (nunca hardcodeado acá, para no dejar la
#      contraseña de la base pegada en un archivo que podría subirse a git
#      sin querer).
#   2. Corre pg_dump y guarda un .sql con la fecha de hoy en backups\diarios.
#   3. Si hoy es domingo, copia ese mismo dump a backups\semanales.
#   4. Si hoy es el día 1 del mes, lo copia a backups\mensuales.
#   5. Borra diarios de más de 14 días y semanales de más de 8 semanas
#      (los mensuales NO se borran solos — revisalos vos de tanto en tanto).
#   6. Escribe backups\ultimo-backup-exitoso.txt con la fecha/hora — para
#      poder chequear de un vistazo si algo dejó de correr, sin tener que
#      abrir ningún log.
#
# CÓMO PROGRAMARLO (una sola vez):
#   1. Abrí "Programador de tareas" de Windows (Task Scheduler).
#   2. "Crear tarea básica" → nombre "Backup FM RRHH" → Diariamente, 03:00.
#   3. Acción: "Iniciar un programa" → Programa: powershell.exe
#      Argumentos: -ExecutionPolicy Bypass -File "C:\Users\ferna\Documents\PROYECTOS\CONSULTORA_DE_RRHH\SISTEMA_DE_LIQUIDACION\fm-rrhh-app\scripts\backup-diario.ps1"
#   4. En las propiedades de la tarea, pestaña "Configuración", marcá
#      "Ejecutar la tarea tan pronto como sea posible tras un inicio
#      programado perdido" — así si la PC está apagada a las 3am, corre
#      apenas la prendas.
#   5. OJO: esto necesita que tu PC (o el servidor donde termines
#      desplegando) esté prendida y con Windows iniciado sesión en algún
#      momento del día — si es tu notebook personal y la apagás siempre,
#      capaz conviene correrlo en otra máquina que quede siempre encendida.

$ErrorActionPreference = "Stop"

$carpetaProyecto = Split-Path -Parent $PSScriptRoot
$archivoEnv = Join-Path $carpetaProyecto ".env"
$carpetaBackups = Join-Path $carpetaProyecto "backups"

# ── Leer DATABASE_URL de .env ──
if (-not (Test-Path $archivoEnv)) {
    Write-Error "No se encontró .env en $archivoEnv"
    exit 1
}
$lineaDbUrl = Get-Content $archivoEnv | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
if (-not $lineaDbUrl) {
    Write-Error "No se encontró DATABASE_URL en .env"
    exit 1
}
$databaseUrl = ($lineaDbUrl -replace "^DATABASE_URL=", "").Trim('"')

# ── Confirmar que pg_dump está instalado ──
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Error "pg_dump no está instalado o no está en el PATH. Instalá 'PostgreSQL Command Line Tools' desde https://www.postgresql.org/download/windows/ (no hace falta el servidor completo, solo los 'Command Line Tools' en el instalador)."
    exit 1
}

# ── Armar carpetas ──
$carpetaDiarios = Join-Path $carpetaBackups "diarios"
$carpetaSemanales = Join-Path $carpetaBackups "semanales"
$carpetaMensuales = Join-Path $carpetaBackups "mensuales"
New-Item -ItemType Directory -Force -Path $carpetaDiarios, $carpetaSemanales, $carpetaMensuales | Out-Null

# ── Hacer el dump ──
$fecha = Get-Date -Format "yyyy-MM-dd_HHmm"
$nombreArchivo = "fm-rrhh_$fecha.sql"
$rutaDiario = Join-Path $carpetaDiarios $nombreArchivo

Write-Host "Iniciando backup: $nombreArchivo"
& pg_dump $databaseUrl --format=plain --no-owner --no-privileges --file="$rutaDiario"

if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump terminó con error (código $LASTEXITCODE) — el backup de hoy NO se completó."
    exit 1
}

$tamanioMB = [math]::Round((Get-Item $rutaDiario).Length / 1MB, 2)
Write-Host "✔ Backup diario guardado: $rutaDiario ($tamanioMB MB)"

# ── Copia semanal (domingos) ──
if ((Get-Date).DayOfWeek -eq "Sunday") {
    Copy-Item $rutaDiario (Join-Path $carpetaSemanales $nombreArchivo)
    Write-Host "✔ Copiado también a semanales (es domingo)"
}

# ── Copia mensual (día 1) ──
if ((Get-Date).Day -eq 1) {
    Copy-Item $rutaDiario (Join-Path $carpetaMensuales $nombreArchivo)
    Write-Host "✔ Copiado también a mensuales (es día 1)"
}

# ── Limpieza de diarios y semanales viejos (los mensuales NO se tocan) ──
Get-ChildItem $carpetaDiarios -Filter "*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item
Get-ChildItem $carpetaSemanales -Filter "*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-56) } | Remove-Item

# ── Registro de último backup exitoso — para chequear de un vistazo ──
$archivoUltimoExito = Join-Path $carpetaBackups "ultimo-backup-exitoso.txt"
"$( Get-Date -Format 'yyyy-MM-dd HH:mm:ss' ) — $nombreArchivo ($tamanioMB MB)" | Set-Content $archivoUltimoExito

Write-Host "Listo."
