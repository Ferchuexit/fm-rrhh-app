-- CreateTable
CREATE TABLE "PlantillaIngreso" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tareas" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaIngreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingreso" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'en_curso',
    "iniciadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "Ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TareaIngreso" (
    "id" TEXT NOT NULL,
    "ingresoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT,
    "responsable" TEXT NOT NULL,
    "vence" TIMESTAMP(3) NOT NULL,
    "clave" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "hechaPor" TEXT,
    "hechaEn" TIMESTAMP(3),
    "nota" TEXT,

    CONSTRAINT "TareaIngreso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaIngreso_empresaId_nombre_key" ON "PlantillaIngreso"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Ingreso_legajoId_estado_idx" ON "Ingreso"("legajoId", "estado");

-- CreateIndex
CREATE INDEX "TareaIngreso_ingresoId_orden_idx" ON "TareaIngreso"("ingresoId", "orden");

-- AddForeignKey
ALTER TABLE "PlantillaIngreso" ADD CONSTRAINT "PlantillaIngreso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingreso" ADD CONSTRAINT "Ingreso_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaIngreso" ADD CONSTRAINT "TareaIngreso_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "Ingreso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
