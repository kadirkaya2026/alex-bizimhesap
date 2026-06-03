import type { OrderDraft } from "./order-draft.schema.js";
import { repairLinePricesFromPdfText } from "./repair-prices.js";
import { repairLineQuantitiesFromPdfText } from "./repair-quantities.js";

const MAX_PDF_TEXT_STORE = 12_000;

export function truncatePdfTextForStorage(pdfText: string): string {
  return pdfText.slice(0, MAX_PDF_TEXT_STORE);
}

/** PDF metninden adet ve birim fiyat düzeltmelerini uygular. */
export function repairOrderDraftFromPdfText(
  pdfText: string,
  draft: OrderDraft,
): OrderDraft {
  const qtyRepaired = repairLineQuantitiesFromPdfText(pdfText, draft);
  return repairLinePricesFromPdfText(pdfText, qtyRepaired);
}
