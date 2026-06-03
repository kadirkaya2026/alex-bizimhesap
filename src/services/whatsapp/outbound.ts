import { getEnv, isWhatsAppConfigured } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { ResolvedCustomer } from "../matching/customer.js";
import type { CatalogStats } from "../matching/catalog.js";
import type { ResolvedLine, StockWarning } from "../matching/resolve-order.js";
import { formatSourceLabel } from "../matching/smart-mapping.js";
import type { MappingWarning } from "../matching/smart-mapping.js";
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
  mappingWarnings?: MappingWarning[];
  customerSuggestion?: CustomerSuggestion;
  productSuggestions?: ProductSuggestion[];
  catalogStats?: CatalogStats;
}): string {
  const output: string[] = ["Sipariş özeti"];

  if (params.customer?.customerId) {
    const src = formatSourceLabel(
      params.customer.source,
      params.customer.matchScore,
    );
    const cariLabel =
      params.customer.bizimhesapTitle ?? params.customerName;
    const idHint =
      params.customer.customerId.length > 8
        ? ` #${params.customer.customerId.slice(0, 8)}…`
        : ` #${params.customer.customerId}`;
    output.push(`Cari: ${params.customerName} ✓ → ${cariLabel} (${src}${idHint})`);
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
        const src = formatSourceLabel(line.source, line.matchScore);
        const displayName = line.bizimhesapTitle ?? line.name;
        const idHint =
          line.productId.length > 8
            ? ` #${line.productId.slice(0, 8)}…`
            : ` #${line.productId}`;
        if (line.source === "fallback") {
          output.push(
            `• ${line.name} ${qtyLabel} ⚠ varsayılan stok → ${displayName} (${src}${idHint})`,
          );
        } else if (stockWarn) {
          output.push(
            `• ${line.name} ${qtyLabel} ⚠ stok: ${stockWarn.available} (istenen: ${stockWarn.requested}) → ${displayName}`,
          );
        } else {
          output.push(
            `• ${line.name} ${qtyLabel} ✓ → ${displayName} (${src}${idHint})`,
          );
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

  const catalogEmpty =
    params.catalogStats &&
    params.catalogStats.parsedCustomers === 0 &&
    params.catalogStats.parsedProducts === 0;
  if (catalogEmpty) {
    output.push(
      "",
      "⚠ Bizimhesap kataloğu yüklenemedi (0 cari, 0 ürün). Yönetici sync/catalog kontrol etmeli.",
    );
  }

  const mappingWarnings = params.mappingWarnings ?? [];
  if (mappingWarnings.length > 0) {
    output.push("", "Eşleştirme uyarıları:");
    for (const warn of mappingWarnings) {
      output.push(`• ${warn.message}`);
    }
  }

  const blocking = params.blockingErrors ?? [];
  if (blocking.length > 0) {
    output.push("", "Eksik yapılandırma — fişleme başarısız olabilir:");
    for (const err of blocking) {
      output.push(`• ${err}`);
    }
    output.push(
      "",
      "BIZIMHESAP_FALLBACK_CUSTOMER_ID ve BIZIMHESAP_FALLBACK_PRODUCT_ID ayarlayın.",
    );
  }

  if (params.stockWarnings?.length && blocking.length === 0) {
    output.push("", "Stok uyarısı var; yine de ONAYLA ile devam edebilirsiniz.");
  }

  if (mappingWarnings.some((w) => w.type === "customer" || w.type === "product")) {
    output.push("", "Varsayılan cari/stok kullanıldı; ONAYLA ile fişlenebilir.");
  }

  output.push(
    "",
    "ONAYLA yazınca Bizimhesap'a satış faturası açılır.",
    "İPTAL ile vazgeçebilirsiniz.",
    "Manuel düzeltme: CARI:<id>  SKU:<kod>  SKU2:<kod>  YENIDEN",
  );
  return output.join("\n");
}

export function formatBlockingErrorsMessage(params: {
  blockingErrors: string[];
  mappingWarnings?: MappingWarning[];
  customerSuggestion?: CustomerSuggestion;
  productSuggestions?: ProductSuggestion[];
  catalogStats?: CatalogStats;
}): string {
  const lines = [
    "Fişleme yapılamadı:",
    ...params.blockingErrors.map((e) => `• ${e}`),
  ];

  for (const warn of params.mappingWarnings ?? []) {
    lines.push(`• ${warn.message}`);
  }

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
    "BIZIMHESAP_FALLBACK_CUSTOMER_ID ve BIZIMHESAP_FALLBACK_PRODUCT_ID Railway Variables'a ekleyin.",
  );
  return lines.join("\n");
}
