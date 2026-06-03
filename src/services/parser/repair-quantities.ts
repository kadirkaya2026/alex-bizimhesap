import type { OrderDraft, OrderDraftLine } from "./order-draft.schema.js";
import { logger } from "../../lib/logger.js";
import {
  extractMoneyAmountsFromBlock,
  findProductBlocksInPdf,
} from "./pdf-line-blocks.js";
import { productSectionRows } from "./repair-prices.js";

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

/** Blok metninden adet adaylarını çıkarır (Adet sütunu, x2, 2x, 2 adet, 2.00 vb.). */
function extractQtyCandidatesFromBlock(block: string): number[] {
  const candidates: number[] = [];
  const sectionText = productSectionRows(block).join("\n");
  const patterns: RegExp[] = [
    /\b(\d{1,4})\s*adet\b/i,
    /\bx(\d{1,4})\b/i,
    /\b(\d{1,4})\s*x\b/i,
    /\b(\d{1,4})x\b/i,
    /miktar\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
    /\bqty\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
    /\b(\d{1,4}[.,]00)\b/,
    /\s(\d{1,4})\s+[\d.,]+\s*(?:\$|€|₺|TL|USD|EUR)\s+[\d.,]+\s*(?:\$|€|₺|TL|USD|EUR)?/i,
  ];

  for (const pattern of patterns) {
    const match = sectionText.match(pattern);
    if (match?.[1]) {
      const qty = parseQtyToken(match[1]);
      if (qty != null) candidates.push(qty);
    }
  }

  // pdf-parse: adet tek başına satırda (örn. "2" satırı)
  for (const row of productSectionRows(block)) {
    const trimmed = row.trim();
    if (/^\d{1,4}$/.test(trimmed)) {
      const qty = parseQtyToken(trimmed);
      if (qty != null) candidates.push(qty);
    }
  }

  return candidates.filter((n) => n > 0 && n <= 9999);
}

function inferQtyFromPriceAndTotal(
  unitPrice: number,
  block: string,
): number | null {
  if (unitPrice <= 0) return null;

  const totals = extractMoneyAmountsFromBlock(block);
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
  const blocks = findProductBlocksInPdf(pdfText, line);
  for (const block of blocks) {
    const candidates = extractQtyCandidatesFromBlock(block);
    const fromPrice = inferQtyFromPriceAndTotal(
      line.unitPrice,
      productSectionRows(block).join("\n"),
    );
    if (fromPrice != null) candidates.push(fromPrice);

    const best = pickBestQty(candidates);
    if (best != null) return best;
  }

  return null;
}

/** draft.total ile satır toplamları uyuşmuyorsa eksik adeti tahmin et. */
export function inferQtyFromDraftTotals(draft: OrderDraft): OrderDraft {
  const targetTotal = draft.subtotal ?? draft.total;
  if (targetTotal == null || targetTotal <= 0) return draft;

  const lineSum = draft.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  if (Math.abs(lineSum - targetTotal) < 0.02) return draft;

  const diff = targetTotal - lineSum;
  if (Math.abs(diff) < 0.01) return draft;

  const lines = draft.lines.map((line) => ({ ...line }));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.unitPrice <= 0) continue;

    const extraUnits = Math.round(diff / line.unitPrice);
    if (extraUnits >= 1 && Math.abs(diff - extraUnits * line.unitPrice) < 0.05) {
      logger.info(
        { product: line.name, gptQty: line.qty, repairedQty: line.qty + extraUnits },
        "Fiş adeti toplam tutardan düzeltildi",
      );
      lines[i] = { ...line, qty: line.qty + extraUnits };
      return { ...draft, lines };
    }
  }

  return draft;
}

function applyQtyRepair(line: OrderDraftLine, extracted: number): OrderDraftLine {
  if (extracted === line.qty) return line;

  if (extracted > 1 && line.qty === 1) {
    logger.info(
      { product: line.name, gptQty: line.qty, repairedQty: extracted },
      "Fiş adeti PDF metninden düzeltildi",
    );
    return { ...line, qty: extracted };
  }

  if (line.qty > 1 && extracted === 1) return line;

  if (extracted !== line.qty) {
    logger.info(
      { product: line.name, gptQty: line.qty, repairedQty: extracted },
      "Fiş adeti PDF metninden düzeltildi",
    );
    return { ...line, qty: extracted };
  }

  return line;
}

/** GPT adet hatasını fiş metninden düzeltir; doğru adetleri 1'e düşürmez. */
export function repairLineQuantitiesFromPdfText(
  pdfText: string,
  draft: OrderDraft,
): OrderDraft {
  let lines = draft.lines.map((line) => {
    const extracted = extractQtyFromPdfText(pdfText, line);
    if (extracted == null) return line;
    return applyQtyRepair(line, extracted);
  });

  return inferQtyFromDraftTotals({ ...draft, lines });
}
