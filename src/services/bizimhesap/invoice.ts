import type { OrderDraft, OrderDraftLine } from "../parser/order-draft.schema.js";
import { resolveInvoiceCurrency } from "./currency.js";
import { postAddInvoiceRaw } from "./client.js";
import type { BizimhesapAddInvoicePayload } from "./types.js";

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function computeLine(line: OrderDraftLine, defaultTaxRate: number) {
  const taxRate = line.taxRate ?? defaultTaxRate;
  const gross = line.qty * line.unitPrice;
  const discount = 0;
  const net = gross - discount;
  const tax = (net * taxRate) / 100;
  const total = net + tax;

  return {
    taxRate,
    gross,
    discount,
    net,
    tax,
    total,
  };
}

export interface InvoiceProductLineMeta {
  productId?: string;
  bizimhesapTitle?: string;
  bizimhesapBarcode?: string;
  invoiceLineNote?: string;
}

export function buildAddInvoicePayload(params: {
  draft: OrderDraft;
  firmId: string;
  defaultTaxRate: number;
  defaultDueDays: number;
  defaultCurrency: string;
  customerId?: string;
  productIdByLine?: (line: OrderDraftLine, index: number) => string | undefined;
  productMetaByLine?: (index: number) => InvoiceProductLineMeta | undefined;
  requireMappedIds?: boolean;
}): BizimhesapAddInvoicePayload {
  const { draft, firmId, defaultTaxRate, defaultDueDays, defaultCurrency } =
    params;

  if (params.requireMappedIds) {
    if (!params.customerId) {
      throw new Error("Cari eşleşmesi zorunlu — customerId eksik");
    }
    for (let i = 0; i < draft.lines.length; i++) {
      const meta = params.productMetaByLine?.(i);
      const productId =
        meta?.productId ?? params.productIdByLine?.(draft.lines[i]!, i);
      if (!productId) {
        throw new Error(`Ürün eşleşmesi zorunlu — satır ${i + 1}: ${draft.lines[i]!.name}`);
      }
    }
  }

  const invoiceDate = draft.orderDate
    ? new Date(draft.orderDate)
    : new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + defaultDueDays);

  const toIso = (d: Date) => d.toISOString();
  const invoiceCurrency = resolveInvoiceCurrency(draft, defaultCurrency);

  const details = draft.lines.map((line, index) => {
    const calc = computeLine(line, defaultTaxRate);
    const meta = params.productMetaByLine?.(index);
    const productId =
      meta?.productId ?? params.productIdByLine?.(line, index);

    const productName = meta?.bizimhesapTitle ?? (productId ? "" : line.name);
    if (!productName && productId) {
      throw new Error(
        `Ürün adı eksik — satır ${index + 1}: katalog başlığı bulunamadı (productId=${productId})`,
      );
    }

    const barcode =
      productId && meta?.bizimhesapBarcode
        ? meta.bizimhesapBarcode
        : productId
          ? undefined
          : line.sku ?? undefined;

    return {
      ...(productId ? { productId } : {}),
      productName,
      ...(barcode ? { barcode } : {}),
      ...(meta?.invoiceLineNote ? { note: meta.invoiceLineNote } : {}),
      taxRate: formatMoney(calc.taxRate),
      quantity: line.qty,
      unitPrice: formatMoney(line.unitPrice),
      grossPrice: formatMoney(calc.gross),
      discount: formatMoney(calc.discount),
      net: formatMoney(calc.net),
      tax: formatMoney(calc.tax),
      total: formatMoney(calc.total),
    };
  });

  const grossTotal = details.reduce(
    (sum, d) => sum + Number.parseFloat(d.grossPrice),
    0,
  );
  const netTotal = details.reduce(
    (sum, d) => sum + Number.parseFloat(d.net),
    0,
  );
  const taxTotal = details.reduce(
    (sum, d) => sum + Number.parseFloat(d.tax),
    0,
  );
  const total = details.reduce(
    (sum, d) => sum + Number.parseFloat(d.total),
    0,
  );

  return {
    firmId,
    ...(draft.orderNumber ? { invoiceNo: draft.orderNumber } : {}),
    invoiceType: 3,
    ...(draft.paymentNote ? { note: draft.paymentNote } : {}),
    dates: {
      invoiceDate: toIso(invoiceDate),
      dueDate: toIso(dueDate),
      deliveryDate: toIso(invoiceDate),
    },
    customer: {
      ...(params.customerId ? { customerId: params.customerId } : {}),
      title: draft.customerName,
      ...(draft.taxOffice ? { taxOffice: draft.taxOffice } : {}),
      ...(draft.taxNo ? { taxNo: draft.taxNo } : {}),
      ...(draft.customerPhone ? { phone: draft.customerPhone } : {}),
      address: draft.customerAddress?.trim() || "-",
    },
    amounts: {
      currency: invoiceCurrency,
      gross: formatMoney(grossTotal),
      discount: formatMoney(0),
      net: formatMoney(netTotal),
      tax: formatMoney(taxTotal),
      total: formatMoney(total),
    },
    details,
  };
}

export async function postAddInvoice(payload: BizimhesapAddInvoicePayload) {
  return postAddInvoiceRaw(payload);
}

export { mapDraftCurrencyToBizimhesap, resolveInvoiceCurrency } from "./currency.js";
