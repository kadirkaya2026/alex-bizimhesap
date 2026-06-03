import type { OrderDraftLine } from "../parser/order-draft.schema.js";
import { normalizeCode } from "./score.js";

/** PDF satırından olası SKU/model/barkod adaylarını çıkarır. */
export function extractLineCodeCandidates(line: OrderDraftLine): string[] {
  const codes = new Set<string>();

  if (line.sku?.trim()) {
    codes.add(line.sku.trim());
  }

  const name = line.name.trim();

  // Parantez içi: "Ürün Adı (MODEL-123)"
  for (const match of name.matchAll(/\(([A-Za-z0-9\-_/\\.]{2,})\)/g)) {
    if (match[1]) codes.add(match[1]);
  }

  // Model/Stok/Kod etiketleri
  for (const match of name.matchAll(
    /(?:model|stok|kod|sku|barkod)\s*[:#]?\s*([A-Za-z0-9\-_/\\.]{2,})/gi,
  )) {
    if (match[1]) codes.add(match[1]);
  }

  // Tire/space ile ayrılmış son segment (kısa kod olabilir)
  const parts = name.split(/[\s\-–—/|]+/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && /^[A-Za-z0-9][A-Za-z0-9\-_.]{1,}$/.test(last) && last.length <= 32) {
    codes.add(last);
  }

  return [...codes].filter((c) => normalizeCode(c).length >= 2);
}
