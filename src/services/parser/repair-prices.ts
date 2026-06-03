import type { OrderDraft, OrderDraftLine } from "./order-draft.schema.js";
import { logger } from "../../lib/logger.js";
import {
  extractMoneyAmountsFromBlock,
  findProductBlocksInPdf,
  parseDecimalToken,
  PRODUCT_CODE_PATTERN,
} from "./pdf-line-blocks.js";

function isLikelyNextProductRow(row: string): boolean {
  return PRODUCT_CODE_PATTERN.test(row) && /[A-Za-z]{2,}/.test(row);
}

/** Blok içinde yalnızca hedef ürüne ait satırları döner (sonraki ürün satırında keser). */
export function productSectionRows(block: string): string[] {
  const rows = block.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  if (rows.length === 0) return [];

  const section = [rows[0]!];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (isLikelyNextProductRow(row)) break;
    section.push(row);
  }
  return section;
}

function extractPricesFromBlock(block: string): {
  unitPrice: number | null;
  lineTotal: number | null;
} {
  const rows = productSectionRows(block);

  const firstRowAmounts = extractMoneyAmountsFromBlock(rows[0] ?? "");
  if (firstRowAmounts.length >= 2) {
    return {
      unitPrice: firstRowAmounts[0]!,
      lineTotal: firstRowAmounts[firstRowAmounts.length - 1]!,
    };
  }

  const amounts: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    amounts.push(...extractMoneyAmountsFromBlock(rows[i]!));
    if (amounts.length >= 2) break;
  }

  if (amounts.length === 0) {
    return { unitPrice: null, lineTotal: null };
  }
  if (amounts.length === 1) {
    return { unitPrice: amounts[0]!, lineTotal: null };
  }
  return {
    unitPrice: amounts[0]!,
    lineTotal: amounts[amounts.length - 1]!,
  };
}

export function extractPricesFromPdfText(
  pdfText: string,
  line: OrderDraftLine,
): { unitPrice: number | null; lineTotal: number | null } {
  const blocks = findProductBlocksInPdf(pdfText, line);
  for (const block of blocks) {
    const prices = extractPricesFromBlock(block);
    if (prices.unitPrice != null) return prices;
  }

  for (const block of blocks) {
    const match = block.match(/([\d.,]+)\s*(?:\$|€|₺|TL|USD|EUR)/i);
    if (match?.[1]) {
      const unitPrice = parseDecimalToken(match[1]);
      if (unitPrice != null && unitPrice > 0) {
        return { unitPrice, lineTotal: null };
      }
    }
  }

  return { unitPrice: null, lineTotal: null };
}

function applyPriceRepair(
  line: OrderDraftLine,
  unitPrice: number,
): OrderDraftLine {
  if (Math.abs(line.unitPrice - unitPrice) < 0.001) return line;

  logger.info(
    { product: line.name, gptPrice: line.unitPrice, repairedPrice: unitPrice },
    "Fiş birim fiyatı PDF metninden düzeltildi",
  );
  return { ...line, unitPrice };
}

/** GPT birim fiyat hatalarını fiş metninden düzeltir. */
export function repairLinePricesFromPdfText(
  pdfText: string,
  draft: OrderDraft,
): OrderDraft {
  const lines = draft.lines.map((line) => {
    const { unitPrice, lineTotal } = extractPricesFromPdfText(pdfText, line);
    let updated = line;

    if (unitPrice != null && unitPrice > 0) {
      updated = applyPriceRepair(updated, unitPrice);
    }

    if (
      lineTotal != null &&
      updated.unitPrice > 0 &&
      updated.qty === 1 &&
      lineTotal > updated.unitPrice * 1.5
    ) {
      const inferredQty = Math.round(lineTotal / updated.unitPrice);
      if (
        inferredQty > 1 &&
        Math.abs(lineTotal - inferredQty * updated.unitPrice) < 0.05
      ) {
        updated = { ...updated, qty: inferredQty };
      }
    }

    return updated;
  });

  return { ...draft, lines };
}
