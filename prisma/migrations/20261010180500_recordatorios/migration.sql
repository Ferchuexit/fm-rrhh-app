-- CreateTable
CREATE TABLE "EjecucionRecordatorios" (
    "fecha" TIMESTAMP(3) NOT NULL,
    "iniciadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEn" TIMESTAMP(3),
    "resumen" JSONB,

    CONSTRAINT "EjecucionRecordatorios_pkey" PRIMARY KEY ("fecha")
);

