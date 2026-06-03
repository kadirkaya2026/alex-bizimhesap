import { getEnv, isWhatsAppConfigured } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { ResolvedCustomer } from "../matching/customer.js";
import type { ResolvedLine, StockWarning } from "../matching/resolve-order.js";

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
  customer?: ResolvedCustomer;
  lines?: ResolvedLine[];
  stockWarnings?: StockWarning[];
  blockingErrors?: string[];
}): string {
  const output: string[] = ["Sipariş özeti"];

  if (params.customer?.customerId) {
    const src = params.customer.source === "db" ? "kayıtlı" : "katalog";
    output.push(`Cari: ${params.customerName} ✓ (#${params.customer.customerId}, ${src})`);
  } else {
    output.push(`Cari: ${params.customerName} ✗ eşleşmedi`);
  }

  if (params.orderNumber) {
    output.push(`Sipariş no: ${params.orderNumber}`);
  }

  if (params.lines?.length) {
    for (const line of params.lines) {
      const qtyLabel = `x${line.qty}`;
      if (line.productId) {
        const stockWarn = params.stockWarnings?.find((w) => w.productId === line.productId);
        if (stockWarn) {
          output.push(
            `• ${line.name} ${qtyLabel} ⚠ stok: ${stockWarn.available} (istenen: ${stockWarn.requested})`,
          );
        } else {
          output.push(`• ${line.name} ${qtyLabel} ✓ (#${line.productId})`);
        }
      } else {
        const skuPart = line.sku ? ` SKU:${line.sku}` : "";
        output.push(`• ${line.name} ${qtyLabel} ✗ eşleşmedi${skuPart}`);
      }
    }
  } else {
    output.push(`Kalemler: ${params.lineCount} satır`);
  }

  output.push(`Toplam: ${params.total} (KDV dahil)`);

  const blocking = params.blockingErrors ?? [];
  if (blocking.length > 0) {
    output.push("", "Eşleşmeyen:");
    for (const err of blocking) {
      output.push(`• ${err}`);
    }
    output.push("", "Eşleşmeyen kalem varken ONAYLA çalışmaz.");
  }

  if (params.stockWarnings?.length && blocking.length === 0) {
    output.push("", "Stok uyarısı var; yine de ONAYLA ile devam edebilirsiniz.");
  }

  output.push("", "ONAYLA yazınca Bizimhesap'a satış faturası açılır.", "İPTAL ile vazgeçebilirsiniz.");
  return output.join("\n");
}

export function formatBlockingErrorsMessage(blockingErrors: string[]): string {
  const lines = ["Fişleme yapılamadı — eşleşmeyen kalemler:", ...blockingErrors.map((e) => `• ${e}`)];
  lines.push("", "Bizimhesap'ta cari/ürün kaydı oluşturulmadı. Eşleştirmeyi düzeltip tekrar deneyin.");
  return lines.join("\n");
}
