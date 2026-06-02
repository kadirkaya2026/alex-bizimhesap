import { getEnv } from "../../config/env.js";
import { downloadPdfBuffer } from "../parser/pdf.js";

export async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
  const env = getEnv();
  const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;

  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!metaRes.ok) {
    throw new Error(`Medya meta alınamadı: ${metaRes.status}`);
  }

  const meta = (await metaRes.json()) as { url?: string };
  if (!meta.url) {
    throw new Error("Medya URL bulunamadı");
  }

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Medya indirilemedi: ${fileRes.status}`);
  }

  const buf = Buffer.from(await fileRes.arrayBuffer());
  return buf;
}

export async function downloadPdfFromUrl(url: string): Promise<Buffer> {
  return downloadPdfBuffer(url);
}
