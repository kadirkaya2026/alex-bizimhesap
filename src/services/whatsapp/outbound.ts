import { getEnv, isWhatsAppConfigured } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

export async function sendWhatsAppText(
  toPhoneE164: string,
  body: string,
): Promise<void> {
  if (!isWhatsAppConfigured()) {
    logger.warn({ toPhoneE164, body }, "WhatsApp not configured; message skipped");
    return;
  }

  const env = getEnv();
  const url = `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhoneE164.replace(/^\+/, ""),
      type: "text",
      text: { body },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, text }, "WhatsApp send failed");
    if (response.status === 401) {
      throw new Error(
        "WhatsApp gönderim hatası: 401 — WHATSAPP_ACCESS_TOKEN geçersiz veya süresi dolmuş",
      );
    }
    throw new Error(`WhatsApp gönderim hatası: ${response.status}`);
  }
}

export function formatPreviewMessage(params: {
  customerName: string;
  orderNumber?: string;
  lineCount: number;
  total: string;
}): string {
  const lines = [
    "Sipariş özeti",
    `Cari: ${params.customerName}`,
  ];
  if (params.orderNumber) {
    lines.push(`Sipariş no: ${params.orderNumber}`);
  }
  lines.push(
    `Kalemler: ${params.lineCount} satır`,
    `Toplam: ${params.total} (KDV dahil)`,
    "",
    "ONAYLA yazınca Bizimhesap'a satış faturası açılır.",
    "İPTAL ile vazgeçebilirsiniz.",
  );
  return lines.join("\n");
}
