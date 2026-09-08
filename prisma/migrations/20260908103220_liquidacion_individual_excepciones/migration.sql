-- AlterTable
ALTER TABLE "LiquidacionDetalle" ADD COLUMN     "excluido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forzado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "importeCalculado" DECIMAL(16,2),
ADD COLUMN     "origen" TEXT NOT NULL DEFAULT 'motor';

-- CreateTable
CREATE TABLE "LiquidacionDetalleEdicion" (
    "id" TEXT NOT NULL,
    "liquidacionDetalleId" TEXT NOT NULL,
    "conceptoId" TEXT NOT NULL,
    "tipoAccion" TEXT NOT NULL,
    "valorAnterior" DECIMAL(16,2),
    "valorNuevo" DECIMAL(16,2),
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,

    CONSTRAINT "LiquidacionDetalleEdicion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LiquidacionDetalleEdicion" ADD CONSTRAINT "LiquidacionDetalleEdicion_liquidacionDetalleId_fkey" FOREIGN KEY ("liquidacionDetalleId") REFERENCES "LiquidacionDetalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionDetalleEdicion" ADD CONSTRAINT "LiquidacionDetalleEdicion_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionDetalleEdicion" ADD CONSTRAINT "LiquidacionDetalleEdicion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
