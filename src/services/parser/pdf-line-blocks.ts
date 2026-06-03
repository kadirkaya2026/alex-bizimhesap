import type { OrderDraftLine } from "./order-draft.schema.js";

export const PRODUCT_CODE_PATTERN = /\b[A-Z]{1,4}-\d{2,6}\b/gi;

const BLOCK_WINDOW_LINES = 5;

/** Fiş satırından adet/fiyat çıkarmak için ürün adının anlamlı parçaları. */
export function productKeywords(name: string): string[] {
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

/** Ürün bloğunun fiş satırıyla ne kadar eşleştiğini puanlar. */
export function scoreBlockForProduct(block: string, line: OrderDraftLine): number {
  const keywords = productKeywords(line.name);
  const lower = block.toLowerCase();
  let score = 0;

  for (const code of keywords.filter((k) => PRODUCT_CODE_PATTERN.test(k))) {
    if (lower.includes(code.toLowerCase())) score += 100;
  }

  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) score += 10;
  }

  return score;
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

/**
 * pdf-parse çıktısında ürün adı ve adet/fiyat farklı satırlarda olabilir.
 * Eşleşen satırdan itibaren BLOCK_WINDOW_LINES satırlık blok döner.
 */
export function findProductBlocksInPdf(
  pdfText: string,
  line: OrderDraftLine,
): string[] {
  const keywords = productKeywords(line.name);
  if (keywords.length === 0) return [];

  const rows = pdfText.split(/\r?\n/);
  const blocks: Array<{ block: string; score: number }> = [];

  for (let i = 0; i < rows.length; i++) {
    if (!lineLooksLikeProductRow(rows[i]!, keywords)) continue;
    const block = rows.slice(i, i + BLOCK_WINDOW_LINES).join("\n");
    blocks.push({ block, score: scoreBlockForProduct(block, line) });
  }

  return blocks
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.block);
}

export function parseDecimalToken(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Blok içindeki para birimli tutarları sırayla döner. */
export function extractMoneyAmountsFromBlock(block: string): number[] {
  return [...block.matchAll(/([\d.,]+)\s*(?:\$|€|₺|TL|USD|EUR)/gi)].map((m) =>
    Number.parseFloat(m[1]!.replace(",", ".")),
  );
}
