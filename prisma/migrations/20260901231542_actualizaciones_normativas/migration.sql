-- CreateTable
CREATE TABLE "ActualizacionNormativa" (
    "id" TEXT NOT NULL,
    "norma" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vigenciaDesde" TIMESTAMP(3),
    "fuente" TEXT,
    "queModifica" TEXT NOT NULL,
    "convenios" TEXT,
    "estadoValidacion" TEXT NOT NULL DEFAULT 'pendiente',
    "aplicadaPor" TEXT,
    "fechaAplicacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActualizacionNormativa_pkey" PRIMARY KEY ("id")
);
