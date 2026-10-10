-- CreateTable
CREATE TABLE "PlantillaEgreso" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tareas" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaEgreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Egreso" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "fechaEgreso" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'en_curso',
    "iniciadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),
    "entrevistaMotivo" TEXT,
    "recontratable" TEXT,
    "entrevistaComentario" TEXT,
    "entrevistaPor" TEXT,
    "entrevistaEn" TIMESTAMP(3),

    CONSTRAINT "Egreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TareaEgreso" (
    "id" TEXT NOT NULL,
    "egresoId" TEXT NOT NULL,
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

    CONSTRAINT "TareaEgreso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaEgreso_empresaId_nombre_key" ON "PlantillaEgreso"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Egreso_legajoId_estado_idx" ON "Egreso"("legajoId", "estado");

-- CreateIndex
CREATE INDEX "TareaEgreso_egresoId_orden_idx" ON "TareaEgreso"("egresoId", "orden");

-- AddForeignKey
ALTER TABLE "PlantillaEgreso" ADD CONSTRAINT "PlantillaEgreso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egreso" ADD CONSTRAINT "Egreso_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaEgreso" ADD CONSTRAINT "TareaEgreso_egresoId_fkey" FOREIGN KEY ("egresoId") REFERENCES "Egreso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

