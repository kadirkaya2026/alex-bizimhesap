import type { OrderDraftLine } from "../parser/order-draft.schema.js";
import { normalizeCode } from "./score.js";

/** LA-031, LB-1002, TEST-001 gibi stok/model kodları mı? */
export function looksLikeProductCode(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 32) return false;
  if (!/[A-Za-z]/.test(trimmed) || !/\d/.test(trimmed)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9\-_. ]+$/.test(trimmed);
}

/** Fiş satırında Bizimhesap ürün kodu geçiyor mu? (LA-031 ⊂ Lucatech LA-031 ...) */
export function lineContainsProductCode(
  lineName: string,
  productTitle: string,
): boolean {
  if (!looksLikeProductCode(productTitle)) return false;
  const titleCode = normalizeCode(productTitle);
  if (titleCode.length < 3) return false;
  return normalizeCode(lineName).includes(titleCode);
}

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

  // Gömülü model kodları: "Lucatech LA-031 Ultrasonik..."
  for (const match of name.matchAll(
    /\b([A-Za-z]{1,6}-[A-Za-z0-9]{2,10})\b/g,
  )) {
    if (match[1]) codes.add(match[1]);
  }

  // Model/Stok/Kod etiketleri
  for (const match of name.matchAll(
    /(?:model|stok|kod|sku|barkod)\s*[:#]?\s*([A-Za-z0-9\-_/\\.]{2,})/gi,
  )) {
    if (match[1]) codes.add(match[1]);
  }

  // Tire/space ile ayrılmış segmentler (kısa kod olabilir)
  for (const part of name.split(/[\s\-–—/|]+/).filter(Boolean)) {
    if (
      looksLikeProductCode(part) ||
      (/^[A-Za-z0-9][A-Za-z0-9\-_.]{1,}$/.test(part) && part.length <= 32)
    ) {
      codes.add(part);
    }
  }

  return [...codes].filter((c) => normalizeCode(c).length >= 2);
}
