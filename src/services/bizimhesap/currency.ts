import type { OrderDraft } from "../parser/order-draft.schema.js";

/** OrderDraft ISO para birimini Bizimhesap addinvoice formatına çevirir. */
export function mapDraftCurrencyToBizimhesap(
  draftCurrency: OrderDraft["currency"],
  tenantFallback = "TL",
): string {
  switch (draftCurrency) {
    case "USD":
      return "USD";
    case "EUR":
      return "EUR";
    case "TRY":
    default:
      return tenantFallback === "TL" || tenantFallback === "TRY"
        ? "TL"
        : tenantFallback;
  }
}

export function resolveInvoiceCurrency(
  draft: OrderDraft,
  tenantDefaultCurrency: string,
): string {
  return mapDraftCurrencyToBizimhesap(
    draft.currency ?? "TRY",
    tenantDefaultCurrency,
  );
}
