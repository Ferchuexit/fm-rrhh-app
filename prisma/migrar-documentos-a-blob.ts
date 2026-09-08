// FM RRHH — prisma/migrar-documentos-a-blob.ts
//
// Migra los DocumentoLegajo viejos (contenidoBase64 en Postgres) a Vercel
// Blob. Corré esto UNA VEZ después de tener BLOB_READ_WRITE_TOKEN /
// el store de Blob conectado al proyecto.
//
// A propósito NO borra contenidoBase64 automáticamente — deja los datos
// viejos ahí hasta que confirmes manualmente que la descarga funciona
// bien desde Blob para varios documentos. Cuando estés seguro, corré el
// UPDATE comentado al final (o pedime que te arme un segundo script de
// "limpieza" aparte).
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { createHash } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const documentos = await prisma.documentoLegajo.findMany({
    where: { storageKey: null, contenidoBase64: { not: null } },
  });

  console.log(`Encontrados ${documentos.length} documento(s) para migrar.\n`);

  let migrados = 0;
  let fallidos = 0;

  for (const doc of documentos) {
    try {
      const base64Limpio = doc.contenidoBase64!.includes(",") ? doc.contenidoBase64!.split(",")[1] : doc.contenidoBase64!;
      const buffer = Buffer.from(base64Limpio, "base64");
      const hash = createHash("sha256").update(buffer).digest("hex");

      const blob = await put(`legajos/${doc.legajoId}/migrado-${doc.id}-${doc.nombreArchivoOriginal}`, buffer, {
        access: "private",
        addRandomSuffix: true,
        contentType: doc.tipoMime,
      });

      await prisma.documentoLegajo.update({
        where: { id: doc.id },
        data: { storageKey: blob.url, hash },
      });

      console.log(`✔ ${doc.nombre} (legajo ${doc.legajoId})`);
      migrados++;
    } catch (e: any) {
      console.error(`✗ Error migrando "${doc.nombre}" (id ${doc.id}):`, e.message);
      fallidos++;
    }
  }

  console.log(`\nListo: ${migrados} migrado(s), ${fallidos} con error.`);
  if (fallidos === 0 && migrados > 0) {
    console.log(`
Todo salió bien. IMPORTANTE: contenidoBase64 sigue en la base todavía —
probá abrir varios documentos migrados desde la pantalla real antes de
borrarlo. Cuando estés seguro, corré (o pedime) el script de limpieza que
pone contenidoBase64 = null para los documentos que ya tienen storageKey.
`);
  }
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
