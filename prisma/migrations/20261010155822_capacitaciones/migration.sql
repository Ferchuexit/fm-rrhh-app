-- CreateTable
CREATE TABLE "Habilidad" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" TEXT NOT NULL DEFAULT 'General',
    "vigenciaMeses" INTEGER,

    CONSTRAINT "Habilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabilidadLegajo" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "habilidadId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "vence" TIMESTAMP(3),
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "cargadoPor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabilidadLegajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capacitacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'tecnica',
    "fecha" TIMESTAMP(3) NOT NULL,
    "horas" DOUBLE PRECISION,
    "instructor" TEXT,
    "lugar" TEXT,
    "habilidadId" TEXT,
    "nivelOtorgado" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'programada',
    "creadaPor" TEXT,
    "cerradaPor" TEXT,
    "cerradaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Capacitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenteCapacitacion" (
    "id" TEXT NOT NULL,
    "capacitacionId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "asistio" BOOLEAN,
    "firmadoEn" TIMESTAMP(3),
    "firmaIp" TEXT,

    CONSTRAINT "AsistenteCapacitacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Habilidad_empresaId_nombre_key" ON "Habilidad"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "HabilidadLegajo_legajoId_habilidadId_key" ON "HabilidadLegajo"("legajoId", "habilidadId");

-- CreateIndex
CREATE INDEX "Capacitacion_empresaId_fecha_idx" ON "Capacitacion"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "AsistenteCapacitacion_legajoId_idx" ON "AsistenteCapacitacion"("legajoId");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenteCapacitacion_capacitacionId_legajoId_key" ON "AsistenteCapacitacion"("capacitacionId", "legajoId");

-- AddForeignKey
ALTER TABLE "Habilidad" ADD CONSTRAINT "Habilidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabilidadLegajo" ADD CONSTRAINT "HabilidadLegajo_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabilidadLegajo" ADD CONSTRAINT "HabilidadLegajo_habilidadId_fkey" FOREIGN KEY ("habilidadId") REFERENCES "Habilidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capacitacion" ADD CONSTRAINT "Capacitacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capacitacion" ADD CONSTRAINT "Capacitacion_habilidadId_fkey" FOREIGN KEY ("habilidadId") REFERENCES "Habilidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenteCapacitacion" ADD CONSTRAINT "AsistenteCapacitacion_capacitacionId_fkey" FOREIGN KEY ("capacitacionId") REFERENCES "Capacitacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenteCapacitacion" ADD CONSTRAINT "AsistenteCapacitacion_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El módulo nuevo "Capacitaciones y habilidades" en los roles que vienen
-- armados (solo si todavía no lo tienen: no pisa lo que se haya editado).
-- Los roles propios de cada empresa hay que tildarlos en Roles y permisos.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"capacitaciones":"gestionar"}'::jsonb
  WHERE "id" IN ('rol-rrhh-completo', 'rol-supervisor') AND NOT ("permisos"::jsonb ? 'capacitaciones');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"capacitaciones":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'capacitaciones');
