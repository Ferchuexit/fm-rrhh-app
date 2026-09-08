-- AlterTable
ALTER TABLE "PeriodoAsistencia" ADD COLUMN     "fechaReapertura" TIMESTAMP(3),
ADD COLUMN     "motivoReapertura" TEXT,
ADD COLUMN     "reabiertoPor" TEXT;
