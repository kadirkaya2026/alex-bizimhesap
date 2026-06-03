import type { OrderDraft, OrderDraftLine } from "./order-draft.schema.js";
import { logger } from "../../lib/logger.js";

/** Fiş satırından adet çıkarmak için ürün adının anlamlı parçaları. */
function productKeywords(name: string): string[] {
  return name
    .split(/[\s\-–—/|]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
    .slice(0, 4);
}

function lineLooksLikeProductRow(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  const hits = keywords.filter((k) => lower.includes(k.toLowerCase()));
  return hits.length >= Math.min(2, keywords.length);
}

/** Satır metninden adet adaylarını çıkarır (Adet sütunu, x2, 2 adet vb.). */
function extractQtyCandidatesFromRow(row: string): number[] {
  const candidates: number[] = [];

  const adetMatch = row.match(/\b(\d{1,4})\s*adet\b/i);
  if (adetMatch?.[1]) candidates.push(Number.parseInt(adetMatch[1], 10));

  const xPrefix = row.match(/\bx(\d{1,4})\b/i);
  if (xPrefix?.[1]) candidates.push(Number.parseInt(xPrefix[1], 10));

  const xSuffix = row.match(/\b(\d{1,4})\s*x\b/i);
  if (xSuffix?.[1]) candidates.push(Number.parseInt(xSuffix[1], 10));

  const miktarMatch = row.match(/miktar\s*[:.]?\s*(\d{1,4})/i);
  if (miktarMatch?.[1]) candidates.push(Number.parseInt(miktarMatch[1], 10));

  // eKatalox tablo: ... ürün adı ... 2  8.95 $  17.90 $
  const tableMatch = row.match(
    /\s(\d{1,4})\s+[\d.,]+\s*(?:\$|€|₺|TL|USD|EUR)\s+[\d.,]+\s*(?:\$|€|₺|TL|USD|EUR)?/i,
  );
  if (tableMatch?.[1]) candidates.push(Number.parseInt(tableMatch[1], 10));

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

    if (candidates.length > 0) {
      // En sık tekrar eden veya en büyük mantıklı adet (tablo genelde doğru)
      const best = candidates.sort((a, b) => b - a)[0]!;
      return best;
    }
  }

  return null;
}

/** GPT adet hatasını fiş metninden düzeltir (örn. 2 adet → x1). */
export function repairLineQuantitiesFromPdfText(
  pdfText: string,
  draft: OrderDraft,
): OrderDraft {
  const lines = draft.lines.map((line) => {
    const extracted = extractQtyFromPdfText(pdfText, line);
    if (extracted == null || extracted === line.qty) {
      return line;
    }

    logger.info(
      { product: line.name, gptQty: line.qty, repairedQty: extracted },
      "Fiş adeti PDF metninden düzeltildi",
    );

    return { ...line, qty: extracted };
  });

  return { ...draft, lines };
}
