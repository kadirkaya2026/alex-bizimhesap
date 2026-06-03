import type { OrderDraft, OrderDraftLine } from "./order-draft.schema.js";
import { logger } from "../../lib/logger.js";

const PRODUCT_CODE_PATTERN = /\b[A-Z]{1,4}-\d{2,6}\b/gi;

/** Fiş satırından adet çıkarmak için ürün adının anlamlı parçaları. */
function productKeywords(name: string): string[] {
  const fromCodes = [...name.matchAll(PRODUCT_CODE_PATTERN)].map((m) => m[0]!);
  const fromSplit = name
    .split(/[\s\-–—/|]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const token of [...fromCodes, ...fromSplit]) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(token);
  }
  return keywords.slice(0, 6);
}

function lineLooksLikeProductRow(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  const codeKeywords = keywords.filter((k) => PRODUCT_CODE_PATTERN.test(k));
  if (codeKeywords.length > 0) {
    return codeKeywords.some((k) => lower.includes(k.toLowerCase()));
  }
  const hits = keywords.filter((k) => lower.includes(k.toLowerCase()));
  return hits.length >= Math.min(2, keywords.length);
}

function parseQtyToken(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  const asInt = Number.parseInt(normalized, 10);
  if (Number.isFinite(asInt) && asInt > 0 && asInt <= 9999) {
    return asInt;
  }
  const asFloat = Number.parseFloat(normalized);
  if (
    Number.isFinite(asFloat) &&
    asFloat > 0 &&
    asFloat <= 9999 &&
    Math.abs(asFloat - Math.round(asFloat)) < 0.001
  ) {
    return Math.round(asFloat);
  }
  return null;
}

/** Satır metninden adet adaylarını çıkarır (Adet sütunu, x2, 2x, 2 adet, 2.00 vb.). */
function extractQtyCandidatesFromRow(row: string): number[] {
  const candidates: number[] = [];
  const patterns: RegExp[] = [
    /\b(\d{1,4})\s*adet\b/i,
    /\bx(\d{1,4})\b/i,
    /\b(\d{1,4})\s*x\b/i,
    /\b(\d{1,4})x\b/i,
    /miktar\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
    /\bqty\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
    /\b(\d{1,4}[.,]00)\b/,
    // eKatalox tablo: ... ürün adı ... 2  8.95 $  17.90 $
    /\s(\d{1,4})\s+[\d.,]+\s*(?:\$|€|₺|TL|USD|EUR)\s+[\d.,]+\s*(?:\$|€|₺|TL|USD|EUR)?/i,
  ];

  for (const pattern of patterns) {
    const match = row.match(pattern);
    if (match?.[1]) {
      const qty = parseQtyToken(match[1]);
      if (qty != null) candidates.push(qty);
    }
  }

  return candidates.filter((n) => n > 0 && n <= 9999);
}

/** Birim fiyat × adet ≈ satır tutarı ise adeti doğrular. */
function inferQtyFromPriceAndTotal(
  unitPrice: number,
  row: string,
): number | null {
  if (unitPrice <= 0) return null;

  const totals = [...row.matchAll(/([\d.,]+)\s*(?:\$|€|₺|TL|USD|EUR)/gi)].map(
    (m) => Number.parseFloat(m[1]!.replace(",", ".")),
  );
  if (totals.length < 2) return null;

  const lineTotal = totals[totals.length - 1]!;
  const inferred = lineTotal / unitPrice;
  const rounded = Math.round(inferred);
  if (rounded >= 1 && Math.abs(inferred - rounded) < 0.05) {
    return rounded;
  }
  return null;
}

function pickBestQty(candidates: number[]): number | null {
  if (candidates.length === 0) return null;
  const counts = new Map<number, number>();
  for (const qty of candidates) {
    counts.set(qty, (counts.get(qty) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
}

export function extractQtyFromPdfText(
  pdfText: string,
  line: OrderDraftLine,
): number | null {
  const keywords = productKeywords(line.name);
  if (keywords.length === 0) return null;

  const rows = pdfText.split(/\r?\n/);
  for (const row of rows) {
    if (!lineLooksLikeProductRow(row, keywords)) continue;

    const candidates = extractQtyCandidatesFromRow(row);
    const fromPrice = inferQtyFromPriceAndTotal(line.unitPrice, row);
    if (fromPrice != null) candidates.push(fromPrice);

    const best = pickBestQty(candidates);
    if (best != null) return best;
  }

  return null;
}

/** GPT adet hatasını fiş metninden düzeltir; doğru adetleri 1'e düşürmez. */
export function repairLineQuantitiesFromPdfText(
  pdfText: string,
  draft: OrderDraft,
): OrderDraft {
  const lines = draft.lines.map((line) => {
    const extracted = extractQtyFromPdfText(pdfText, line);
    if (extracted == null || extracted === line.qty) {
      return line;
    }

    // PDF'te 2+ adet net görülüyorsa GPT'nin varsayılan 1'ini düzelt
    if (extracted > 1 && line.qty === 1) {
      logger.info(
        { product: line.name, gptQty: line.qty, repairedQty: extracted },
        "Fiş adeti PDF metninden düzeltildi",
      );
      return { ...line, qty: extracted };
    }

    // Mevcut adet > 1 iken hatalı regex ile 1'e düşürme
    if (line.qty > 1 && extracted === 1) {
      return line;
    }

    if (extracted !== line.qty) {
      logger.info(
        { product: line.name, gptQty: line.qty, repairedQty: extracted },
        "Fiş adeti PDF metninden düzeltildi",
      );
      return { ...line, qty: extracted };
    }

    return line;
  });

  return { ...draft, lines };
}
