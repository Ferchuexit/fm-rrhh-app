-- AlterTable
ALTER TABLE "Fichada" ADD COLUMN     "corregidoPorId" TEXT,
ADD COLUMN     "dispositivoId" TEXT,
ADD COLUMN     "fechaCorreccion" TIMESTAMP(3),
ADD COLUMN     "horaCorregida" TEXT,
ADD COLUMN     "motivoCorreccion" TEXT,
ADD COLUMN     "nivelConfianza" DOUBLE PRECISION,
ADD COLUMN     "sincronizada" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tipo" TEXT;

-- CreateTable
CREATE TABLE "DispositivoAsistencia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT,
    "codigoVinculacion" TEXT NOT NULL,
    "vinculado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaConexion" TIMESTAMP(3),
    "ultimaSincronizacion" TIMESTAMP(3),
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispositivoAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoAsistencia_codigoVinculacion_key" ON "DispositivoAsistencia"("codigoVinculacion");

-- AddForeignKey
ALTER TABLE "Fichada" ADD CONSTRAINT "Fichada_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "DispositivoAsistencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fichada" ADD CONSTRAINT "Fichada_corregidoPorId_fkey" FOREIGN KEY ("corregidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispositivoAsistencia" ADD CONSTRAINT "DispositivoAsistencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
