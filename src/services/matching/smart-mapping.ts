import { getEnv } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { CatalogCache } from "./catalog.js";
import { catalogProductToInvoiceMeta } from "./catalog.js";
import type { ResolvedCustomer } from "./customer.js";
import type { ResolvedProductLine } from "./product.js";
import type { ResolvedLine } from "./resolve-order.js";

export interface MappingWarning {
  type: "customer" | "product";
  message: string;
  lineIndex?: number;
}

export function getFallbackCustomerId(): string | undefined {
  const id = getEnv().BIZIMHESAP_FALLBACK_CUSTOMER_ID?.trim();
  return id && id.length > 0 ? id : undefined;
}

export function getFallbackProductId(): string | undefined {
  const id = getEnv().BIZIMHESAP_FALLBACK_PRODUCT_ID?.trim();
  return id && id.length > 0 ? id : undefined;
}

export async function applyCustomerFallback(
  customer: ResolvedCustomer,
  cache?: CatalogCache,
): Promise<ResolvedCustomer> {
  if (customer.customerId) return customer;

  const fallbackId = getFallbackCustomerId();
  if (!fallbackId) {
    logger.warn(
      { title: customer.title },
      "Cari eşleşmedi ve BIZIMHESAP_FALLBACK_CUSTOMER_ID tanımlı değil",
    );
    return customer;
  }

  let bizimhesapTitle = "WhatsApp Gelen Fişleri";
  if (cache) {
    const found = await cache.findCustomerById(fallbackId);
    if (found) bizimhesapTitle = found.title;
  }

  logger.info(
    { pdfTitle: customer.title, fallbackId, bizimhesapTitle },
    "Cari fallback atandı",
  );

  return {
    ...customer,
    customerId: fallbackId,
    bizimhesapTitle,
    source: "fallback",
    suggestion: undefined,
  };
}

export async function applyProductFallback(
  line: ResolvedProductLine,
  cache?: CatalogCache,
): Promise<ResolvedProductLine> {
  if (line.productId) return line;

  const fallbackId = getFallbackProductId();
  if (!fallbackId) {
    logger.warn(
      { name: line.name },
      "Ürün eşleşmedi ve BIZIMHESAP_FALLBACK_PRODUCT_ID tanımlı değil",
    );
    return line;
  }

  let meta: { bizimhesapTitle: string; bizimhesapBarcode?: string } = {
    bizimhesapTitle: "Tanımsız WhatsApp Ürünü",
  };
  if (cache) {
    const found = await cache.findProductById(fallbackId);
    if (found) meta = catalogProductToInvoiceMeta(found);
  }

  logger.info(
    { pdfName: line.name, fallbackId, bizimhesapTitle: meta.bizimhesapTitle },
    "Ürün fallback atandı",
  );

  return {
    ...line,
    productId: fallbackId,
    ...meta,
    invoiceLineNote: line.name,
    source: "fallback",
    suggestion: undefined,
  };
}

export function buildMappingWarnings(
  customer: ResolvedCustomer,
  lines: ResolvedLine[],
): MappingWarning[] {
  const warnings: MappingWarning[] = [];

  if (customer.source === "fallback") {
    warnings.push({
      type: "customer",
      message: `Cari varsayılan atandı: ${customer.bizimhesapTitle ?? "WhatsApp Gelen Fişleri"} (#${customer.customerId})`,
    });
  } else if (!customer.customerId) {
    warnings.push({
      type: "customer",
      message: `Cari eşleşmedi: ${customer.title} — BIZIMHESAP_FALLBACK_CUSTOMER_ID ayarlayın`,
    });
  }

  for (const line of lines) {
    if (line.source === "fallback") {
      warnings.push({
        type: "product",
        lineIndex: line.index,
        message: `Ürün varsayılan stok: ${line.bizimhesapTitle ?? "Tanımsız WhatsApp Ürünü"} — açıklama: ${line.name}`,
      });
    } else if (!line.productId) {
      warnings.push({
        type: "product",
        lineIndex: line.index,
        message: `Ürün eşleşmedi: ${line.name} — BIZIMHESAP_FALLBACK_PRODUCT_ID ayarlayın`,
      });
    }
  }

  return warnings;
}

export function formatSourceLabel(
  source: string,
  matchScore?: number,
): string {
  if (source === "db") return "kayıtlı";
  if (source === "manual") return "manuel";
  if (source === "fallback") return "varsayılan";
  if (source === "catalog" && matchScore != null) {
    return `fuzzy (%${matchScore})`;
  }
  if (source === "catalog") return "katalog";
  return source;
}
