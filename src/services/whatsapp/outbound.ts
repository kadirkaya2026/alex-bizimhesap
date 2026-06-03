import { getEnv, isWhatsAppConfigured } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { ResolvedCustomer } from "../matching/customer.js";
import type { ResolvedLine, StockWarning } from "../matching/resolve-order.js";
import type {
  CustomerSuggestion,
  ProductSuggestion,
} from "../matching/types.js";

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
  customerSuggestion?: CustomerSuggestion;
  productSuggestions?: ProductSuggestion[];
}): string {
  const output: string[] = ["Sipariş özeti"];

  if (params.customer?.customerId) {
    const src =
      params.customer.source === "db"
        ? "kayıtlı"
        : params.customer.source === "manual"
          ? "manuel"
          : "katalog";
    output.push(
      `Cari: ${params.customerName} ✓ (#${params.customer.customerId}, ${src})`,
    );
  } else {
    output.push(`Cari: ${params.customerName} ✗ eşleşmedi`);
    if (params.customerSuggestion) {
      const s = params.customerSuggestion.suggestion;
      output.push(
        `  → Öneri: ${s.label} (#${s.id}, %${s.score}) — ${s.commandHint} yazın`,
      );
    }
  }

  if (params.orderNumber) {
    output.push(`Sipariş no: ${params.orderNumber}`);
  }

  if (params.lines?.length) {
    for (const line of params.lines) {
      const qtyLabel = `x${line.qty}`;
      if (line.productId) {
        const stockWarn = params.stockWarnings?.find(
          (w) => w.productId === line.productId,
        );
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
        const suggestion = params.productSuggestions?.find(
          (ps) => ps.lineIndex === line.index,
        );
        if (suggestion) {
          const s = suggestion.suggestion;
          output.push(
            `  → Öneri: ${s.label} (#${s.id}, %${s.score}) — ${s.commandHint} yazın`,
          );
        }
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
    output.push("Komutlar: CARI:<id>  SKU:<kod>  SKU2:<kod>  YENIDEN");
  }

  if (params.stockWarnings?.length && blocking.length === 0) {
    output.push("", "Stok uyarısı var; yine de ONAYLA ile devam edebilirsiniz.");
  }

  output.push(
    "",
    "ONAYLA yazınca Bizimhesap'a satış faturası açılır.",
    "İPTAL ile vazgeçebilirsiniz.",
  );
  return output.join("\n");
}

export function formatBlockingErrorsMessage(params: {
  blockingErrors: string[];
  customerSuggestion?: CustomerSuggestion;
  productSuggestions?: ProductSuggestion[];
}): string {
  const lines = [
    "Fişleme yapılamadı — eşleşmeyen kalemler:",
    ...params.blockingErrors.map((e) => `• ${e}`),
  ];

  if (params.customerSuggestion) {
    const s = params.customerSuggestion.suggestion;
    lines.push(
      "",
      `Cari öneri: ${s.label} (#${s.id}, %${s.score}) — ${s.commandHint}`,
    );
  }

  for (const ps of params.productSuggestions ?? []) {
    const s = ps.suggestion;
    lines.push(
      `Satır ${ps.lineIndex + 1} öneri: ${s.label} (#${s.id}) — ${s.commandHint}`,
    );
  }

  lines.push(
    "",
    "Bizimhesap'ta cari/ürün kaydı oluşturulmadı.",
    "Komutlar: CARI:<id>  SKU:<kod>  SKU2:<kod>  YENIDEN",
  );
  return lines.join("\n");
}
